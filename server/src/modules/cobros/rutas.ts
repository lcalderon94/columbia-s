import fs from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../../lib/db.js';
import { body, params, query, zId } from '../../lib/http.js';
import { requierePermiso } from '../../lib/auth.js';
import { conflicto, invalido, noEncontrado } from '../../lib/errores.js';
import { auditar } from '../../lib/auditoria.js';
import { emitir } from '../../lib/realtime.js';
import { repartir } from '../../lib/dinero.js';
import { zMetodoPago } from '../../types/dominio.js';
import { cargarPedido, mapearPedido, sesionCajaAbierta } from '../pedidos/servicio.js';
import { calcularTotales } from '../pedidos/totales.js';
import { datosLocal, emitirFactura, verificarCadena } from './facturas.js';

const zCliente = z.object({
  nombre: z.string().optional().nullable(),
  nif: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  cp: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
});

const zPago = z.object({
  metodo: zMetodoPago,
  importeCent: z.number().int().min(0),
  propinaCent: z.number().int().min(0).default(0),
  entregadoCent: z.number().int().min(0).optional(),
  // El datafono es externo: se anota la referencia que imprime el TPV
  refTerminal: z.string().optional().nullable(),
  refAutorizacion: z.string().optional().nullable(),
  ultimos4: z.string().regex(/^\d{4}$/).optional().nullable(),
});

const zCobrar = z.object({
  pagos: z.array(zPago).min(1),
  emitirFactura: z.boolean().default(true),
  tipoFactura: z.enum(['SIMPLIFICADA', 'COMPLETA']).default('SIMPLIFICADA'),
  cliente: zCliente.optional(),
  /** Deja el pedido abierto (cobro parcial de una cuenta dividida). */
  parcial: z.boolean().default(false),
});

async function totalesDePedido(pedidoId: string) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { lineas: true, pagos: { where: { estado: 'COMPLETADO' } } },
  });
  if (!pedido) throw noEncontrado('Pedido');
  const totales = calcularTotales(
    pedido.lineas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      cantidad: l.cantidad,
      precioUnitCent: l.precioUnitCent,
      modificadorCent: l.modificadorCent,
      ivaTipo: l.ivaTipo,
      estado: l.estado,
      invitada: l.invitada,
      descuentoTipo: l.descuentoTipo,
      descuentoValor: l.descuentoValor,
    })),
    pedido.descuentoTipo,
    pedido.descuentoValor,
  );
  const cobradoCent = pedido.pagos.reduce((a, p) => a + p.importeCent, 0);
  return { pedido, totales, cobradoCent, pendienteCent: totales.totalCent - cobradoCent };
}

export default async function rutasCobros(app: FastifyInstance) {
  /** Previsualizacion de la cuenta antes de cobrar. */
  app.get('/pedido/:id/cuenta', { preHandler: requierePermiso('cobro.realizar') }, async (req) => {
    const { id } = params(req, zId);
    const { totales, cobradoCent, pendienteCent } = await totalesDePedido(id);
    return { totales, cobradoCent, pendienteCent };
  });

  /** Reparto a partes iguales de la cuenta pendiente. */
  app.get('/pedido/:id/dividir', { preHandler: requierePermiso('cobro.realizar') }, async (req) => {
    const { id } = params(req, zId);
    const { partes } = query(req, z.object({ partes: z.coerce.number().int().min(2).max(30) }));
    const { pendienteCent } = await totalesDePedido(id);
    return { partes, importes: repartir(pendienteCent, partes), pendienteCent };
  });

  /**
   * Cobra el pedido: registra los pagos, emite factura y cierra la mesa.
   * Todo dentro de una transaccion, para que no quede un cobro sin factura.
   */
  app.post('/pedido/:id/cobrar', { preHandler: requierePermiso('cobro.realizar') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(req, zCobrar);

    const { pedido, totales, pendienteCent } = await totalesDePedido(id);
    if (pedido.estado === 'ANULADO') throw conflicto('El pedido está anulado');
    if (pedido.estado === 'COBRADO') throw conflicto('El pedido ya está cobrado');
    if (totales.lineas.length === 0) throw invalido('El pedido no tiene líneas que cobrar');

    const sumaPagos = datos.pagos.reduce((a, p) => a + p.importeCent, 0);
    if (sumaPagos <= 0) throw invalido('El importe a cobrar debe ser mayor que cero');
    if (sumaPagos > pendienteCent) {
      throw invalido(
        `Los pagos (${sumaPagos / 100} €) superan lo pendiente (${pendienteCent / 100} €)`,
      );
    }
    if (!datos.parcial && sumaPagos !== pendienteCent) {
      throw invalido(
        `Faltan ${(pendienteCent - sumaPagos) / 100} € por cobrar. Marca "parcial" si es un cobro a cuenta.`,
      );
    }
    if (datos.tipoFactura === 'COMPLETA' && !datos.cliente?.nif) {
      throw invalido('Una factura completa necesita el NIF del cliente');
    }

    // Un pedido de formación se cobra igual de cara al empleado, pero por
    // dentro no se cuelga de la caja ni consume número de factura: un número
    // de la serie no se puede devolver, y borrarlo después dejaría un hueco
    // en la numeración y rompería la cadena de huellas.
    const practica = pedido.esPractica;
    const caja = practica ? null : await sesionCajaAbierta();
    const tieneEfectivo = datos.pagos.some((p) => p.metodo === 'EFECTIVO');
    if (tieneEfectivo && !caja && !practica) {
      throw conflicto('No hay ninguna caja abierta: abre caja antes de cobrar en efectivo');
    }

    const resultado = await prisma.$transaction(async (tx) => {
      for (const p of datos.pagos) {
        const cambioCent =
          p.metodo === 'EFECTIVO' && p.entregadoCent
            ? Math.max(0, p.entregadoCent - p.importeCent)
            : null;
        await tx.pago.create({
          data: {
            pedidoId: id,
            metodo: p.metodo,
            importeCent: p.importeCent,
            propinaCent: p.propinaCent,
            entregadoCent: p.entregadoCent ?? null,
            cambioCent,
            refTerminal: p.refTerminal ?? null,
            refAutorizacion: p.refAutorizacion ?? null,
            ultimos4: p.ultimos4 ?? null,
            usuarioId: req.usuario!.id,
            sesionCajaId: caja?.id ?? null,
            esPractica: practica,
          },
        });
        if (caja && p.metodo === 'EFECTIVO') {
          await tx.movimientoCaja.create({
            data: {
              sesionCajaId: caja.id,
              tipo: 'VENTA',
              importeCent: p.importeCent,
              motivo: `Cobro pedido #${pedido.numero}`,
              usuarioId: req.usuario!.id,
            },
          });
        }
        if (caja && p.propinaCent > 0 && p.metodo === 'EFECTIVO') {
          await tx.movimientoCaja.create({
            data: {
              sesionCajaId: caja.id,
              tipo: 'PROPINA',
              importeCent: p.propinaCent,
              motivo: `Propina pedido #${pedido.numero}`,
              usuarioId: req.usuario!.id,
            },
          });
        }
      }

      const totalmenteCobrado = sumaPagos === pendienteCent;
      let factura = null;

      if (totalmenteCobrado) {
        await tx.pedido.update({
          where: { id },
          data: {
            estado: 'COBRADO',
            cerradoEn: new Date(),
            sesionCajaId: caja?.id ?? pedido.sesionCajaId,
          },
        });
        if (datos.emitirFactura && !practica) {
          factura = await emitirFactura({
            tx,
            pedidoId: id,
            tipo: datos.tipoFactura,
            cliente: datos.cliente ?? undefined,
            usuarioId: req.usuario!.id,
          });
        }
        if (pedido.mesaId) {
          await tx.mesa.update({ where: { id: pedido.mesaId }, data: { estado: 'LIMPIEZA' } });
        }
        await tx.prestamoJuego.updateMany({
          where: { pedidoId: id, estado: 'ACTIVO' },
          data: { estado: 'DEVUELTO', finEn: new Date() },
        });
        await tx.juego.updateMany({
          where: { prestamos: { some: { pedidoId: id, estado: 'DEVUELTO' } }, estado: 'PRESTADO' },
          data: { estado: 'DISPONIBLE' },
        });
        await tx.reserva.updateMany({
          where: { pedidoId: id, estado: 'SENTADA' },
          data: { estado: 'COMPLETADA' },
        });
      }
      return { factura, totalmenteCobrado };
    });

    await auditar({
      usuarioId: req.usuario!.id,
      accion: practica ? 'PRACTICA_COBRO' : 'PEDIDO_COBRADO',
      entidad: 'Pedido',
      entidadId: id,
      detalle: {
        numero: pedido.numero,
        importeCent: sumaPagos,
        metodos: datos.pagos.map((p) => p.metodo),
        factura: resultado.factura?.codigo,
      },
    });

    emitir('sala', 'sala:recargar', {});
    emitir('caja', 'caja:actualizada', {});

    const actualizado = await cargarPedido(id);
    return {
      pedido: mapearPedido(actualizado),
      cerrado: resultado.totalmenteCobrado,
      esPractica: practica,
      factura: resultado.factura
        ? {
            id: resultado.factura.id,
            codigo: resultado.factura.codigo,
            tipo: resultado.factura.tipo,
            totalCent: resultado.factura.totalCent,
            hash: resultado.factura.hash,
          }
        : null,
    };
  });

  /**
   * Recibo de un cobro de prácticas. Se genera al vuelo y NO se guarda:
   * no lleva número de serie ni huella, y sale marcado como sin validez.
   */
  app.get('/pedido/:id/recibo-practica', { preHandler: requierePermiso('cobro.realizar') }, async (req, rep) => {
    const { id } = params(req, zId);
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        lineas: true,
        pagos: { where: { estado: 'COMPLETADO' } },
        mesa: true,
        camarero: { select: { nombre: true } },
      },
    });
    if (!pedido) throw noEncontrado('Pedido');
    if (!pedido.esPractica) throw invalido('Ese pedido no es de prácticas');

    const { totales } = await totalesDePedido(id);
    const { generarReciboHtml } = await import('./recibo.js');

    const html = generarReciboHtml({
      codigo: 'PRÁCTICAS · SIN VALIDEZ',
      tipo: 'SIMPLIFICADA',
      fechaEmision: new Date(),
      local: await datosLocal(),
      mesa: pedido.mesa?.nombre ?? null,
      camarero: pedido.camarero?.nombre ?? null,
      comensales: pedido.comensales,
      pedidoNumero: pedido.numero,
      lineas: totales.lineas.map((l) => ({
        nombre: l.nombre,
        cantidad: l.cantidad,
        precioUnitCent: l.precioUnitCent + l.modificadorCent,
        totalCent: l.totalCent,
        invitada: l.invitada,
      })),
      desglose: totales.desglose,
      descuentoCent: totales.descuentoTotalCent,
      baseCent: totales.baseCent,
      cuotaCent: totales.cuotaCent,
      totalCent: totales.totalCent,
      propinaCent: pedido.pagos.reduce((a, p) => a + p.propinaCent, 0),
      pagos: pedido.pagos.map((p) => ({
        metodo: p.metodo,
        importeCent: p.importeCent,
        ultimos4: p.ultimos4,
        refAutorizacion: p.refAutorizacion,
      })),
      cambioCent: pedido.pagos.reduce((a, p) => a + (p.cambioCent ?? 0), 0) || undefined,
      hash: 'SIN HUELLA - RECIBO DE FORMACION',
    });

    return rep.type('text/html; charset=utf-8').send(html);
  });

  /** Anula un cobro mal introducido (solo mientras no haya factura emitida). */
  app.post('/pagos/:id/anular', { preHandler: requierePermiso('cobro.anular') }, async (req) => {
    const { id } = params(req, zId);
    const { motivo } = body(req, z.object({ motivo: z.string().min(3) }));
    const pago = await prisma.pago.findUnique({
      where: { id },
      include: { pedido: { include: { facturas: { where: { estado: 'EMITIDA' } } } } },
    });
    if (!pago) throw noEncontrado('Pago');
    if (pago.estado === 'ANULADO') throw conflicto('El pago ya está anulado');
    if (pago.pedido.facturas.length > 0) {
      throw conflicto(
        'El pedido ya tiene factura emitida: hay que emitir una factura rectificativa',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.pago.update({ where: { id }, data: { estado: 'ANULADO', anuladoEn: new Date() } });
      if (pago.sesionCajaId && pago.metodo === 'EFECTIVO') {
        await tx.movimientoCaja.create({
          data: {
            sesionCajaId: pago.sesionCajaId,
            tipo: 'SALIDA',
            importeCent: pago.importeCent,
            motivo: `Anulación de cobro: ${motivo}`,
            usuarioId: req.usuario!.id,
          },
        });
      }
      await tx.pedido.update({
        where: { id: pago.pedidoId },
        data: { estado: 'PARA_COBRAR', cerradoEn: null },
      });
    });

    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'PAGO_ANULADO',
      entidad: 'Pago',
      entidadId: id,
      detalle: { importeCent: pago.importeCent, metodo: pago.metodo, motivo },
    });
    emitir('caja', 'caja:actualizada', {});
    emitir('sala', 'sala:recargar', {});
    return { ok: true };
  });

  // -- Facturas -------------------------------------------------------------
  app.get('/facturas', { preHandler: requierePermiso('factura.emitir') }, async (req) => {
    const q = query(
      req,
      z.object({
        desde: z.coerce.date().optional(),
        hasta: z.coerce.date().optional(),
        tipo: z.string().optional(),
        texto: z.string().optional(),
        limite: z.coerce.number().int().min(1).max(500).default(100),
      }),
    );
    const facturas = await prisma.factura.findMany({
      where: {
        fechaEmision: { gte: q.desde, lte: q.hasta },
        tipo: q.tipo,
        OR: q.texto
          ? [
              { codigo: { contains: q.texto } },
              { clienteNombre: { contains: q.texto } },
              { clienteNif: { contains: q.texto } },
            ]
          : undefined,
      },
      orderBy: { fechaEmision: 'desc' },
      take: q.limite,
      include: {
        pedido: { select: { numero: true } },
        usuario: { select: { nombre: true } },
      },
    });
    return facturas.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      tipo: f.tipo,
      fechaEmision: f.fechaEmision,
      clienteNombre: f.clienteNombre,
      clienteNif: f.clienteNif,
      baseCent: f.baseCent,
      cuotaCent: f.cuotaCent,
      totalCent: f.totalCent,
      estado: f.estado,
      pedidoNumero: f.pedido?.numero ?? null,
      emitidaPor: f.usuario?.nombre ?? null,
      hash: f.hash,
    }));
  });

  app.get('/facturas/:id', { preHandler: requierePermiso('factura.emitir') }, async (req) => {
    const { id } = params(req, zId);
    const f = await prisma.factura.findUnique({
      where: { id },
      include: { pedido: { select: { numero: true } }, rectificaA: { select: { codigo: true } } },
    });
    if (!f) throw noEncontrado('Factura');
    return {
      ...f,
      lineas: JSON.parse(f.lineasJson),
      desglose: JSON.parse(f.desgloseJson),
      pagos: JSON.parse(f.pagosJson),
      lineasJson: undefined,
      desgloseJson: undefined,
      pagosJson: undefined,
    };
  });

  /** Devuelve el recibo tal cual se guardo, listo para imprimir. */
  app.get('/facturas/:id/recibo', { preHandler: requierePermiso('factura.emitir') }, async (req, rep) => {
    const { id } = params(req, zId);
    const f = await prisma.factura.findUnique({ where: { id } });
    if (!f) throw noEncontrado('Factura');
    if (!f.rutaHtml) throw noEncontrado('Recibo');
    const html = await fs.readFile(f.rutaHtml, 'utf8');
    return rep.type('text/html; charset=utf-8').send(html);
  });

  /**
   * Emite una factura completa a partir de un pedido ya cobrado, cuando el
   * cliente pide factura con sus datos despues de pagar.
   */
  app.post('/facturas/completa', { preHandler: requierePermiso('factura.emitir') }, async (req) => {
    const datos = body(
      req,
      z.object({ pedidoId: z.string(), cliente: zCliente.required({ nif: true }) }),
    );
    const pedido = await prisma.pedido.findUnique({
      where: { id: datos.pedidoId },
      include: { facturas: { where: { estado: 'EMITIDA', tipo: 'COMPLETA' } } },
    });
    if (!pedido) throw noEncontrado('Pedido');
    if (pedido.estado !== 'COBRADO') throw conflicto('El pedido todavía no está cobrado');
    if (pedido.facturas.length) throw conflicto('Ese pedido ya tiene factura completa');

    const factura = await prisma.$transaction((tx) =>
      emitirFactura({
        tx,
        pedidoId: datos.pedidoId,
        tipo: 'COMPLETA',
        cliente: datos.cliente,
        usuarioId: req.usuario!.id,
      }),
    );
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'FACTURA_COMPLETA_EMITIDA',
      entidad: 'Factura',
      entidadId: factura.id,
      detalle: { codigo: factura.codigo, nif: datos.cliente.nif },
    });
    return { id: factura.id, codigo: factura.codigo, totalCent: factura.totalCent };
  });

  /**
   * Factura rectificativa: nunca se borra ni se modifica una factura emitida,
   * se emite otra con signo negativo que la anula.
   */
  app.post('/facturas/:id/rectificar', { preHandler: requierePermiso('factura.rectificar') }, async (req) => {
    const { id } = params(req, zId);
    const { motivo } = body(req, z.object({ motivo: z.string().min(3) }));
    const original = await prisma.factura.findUnique({ where: { id } });
    if (!original) throw noEncontrado('Factura');
    if (original.estado === 'ANULADA') throw conflicto('Esa factura ya está anulada');
    if (!original.pedidoId) throw invalido('La factura no está ligada a un pedido');

    const rectificativa = await prisma.$transaction(async (tx) => {
      const nueva = await emitirFactura({
        tx,
        pedidoId: original.pedidoId!,
        tipo: 'RECTIFICATIVA',
        cliente: {
          nombre: original.clienteNombre,
          nif: original.clienteNif,
          direccion: original.clienteDireccion,
          cp: original.clienteCp,
          ciudad: original.clienteCiudad,
        },
        usuarioId: req.usuario!.id,
        rectificaAId: original.id,
        motivoRectificacion: motivo,
        signo: -1,
      });
      await tx.factura.update({ where: { id }, data: { estado: 'ANULADA' } });
      return nueva;
    });

    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'FACTURA_RECTIFICADA',
      entidad: 'Factura',
      entidadId: id,
      detalle: { original: original.codigo, rectificativa: rectificativa.codigo, motivo },
    });
    return {
      id: rectificativa.id,
      codigo: rectificativa.codigo,
      totalCent: rectificativa.totalCent,
    };
  });

  /** Comprueba que la cadena de huellas sigue intacta. */
  app.get('/facturas-verificar', { preHandler: requierePermiso('informes.ver') }, async () => {
    return verificarCadena();
  });

  /** Libro de IVA repercutido del periodo. */
  app.get('/libro-iva', { preHandler: requierePermiso('informes.ver') }, async (req) => {
    const q = query(
      req,
      z.object({
        desde: z.coerce.date().default(dayjs().startOf('month').toDate()),
        hasta: z.coerce.date().default(dayjs().endOf('month').toDate()),
      }),
    );
    const facturas = await prisma.factura.findMany({
      where: { fechaEmision: { gte: q.desde, lte: q.hasta } },
      orderBy: { fechaEmision: 'asc' },
    });
    const porTipo = new Map<number, { baseCent: number; cuotaCent: number }>();
    for (const f of facturas) {
      for (const d of JSON.parse(f.desgloseJson) as any[]) {
        const acc = porTipo.get(d.ivaTipo) ?? { baseCent: 0, cuotaCent: 0 };
        acc.baseCent += d.baseCent;
        acc.cuotaCent += d.cuotaCent;
        porTipo.set(d.ivaTipo, acc);
      }
    }
    return {
      desde: q.desde,
      hasta: q.hasta,
      local: await datosLocal(),
      facturas: facturas.map((f) => ({
        codigo: f.codigo,
        fecha: f.fechaEmision,
        tipo: f.tipo,
        cliente: f.clienteNombre,
        nif: f.clienteNif,
        baseCent: f.baseCent,
        cuotaCent: f.cuotaCent,
        totalCent: f.totalCent,
        estado: f.estado,
      })),
      resumen: [...porTipo.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([ivaTipo, v]) => ({ ivaTipo, ...v })),
      totales: {
        baseCent: facturas.reduce((a, f) => a + f.baseCent, 0),
        cuotaCent: facturas.reduce((a, f) => a + f.cuotaCent, 0),
        totalCent: facturas.reduce((a, f) => a + f.totalCent, 0),
        numFacturas: facturas.length,
      },
    };
  });
}
