import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { body, params, query, zId } from '../../lib/http.js';
import { exigirPermiso, requierePermiso } from '../../lib/auth.js';
import { conflicto, invalido, noEncontrado } from '../../lib/errores.js';
import { auditar } from '../../lib/auditoria.js';
import { emitir, emitirDestino } from '../../lib/realtime.js';
import { siguienteNumero } from '../../lib/contador.js';
import { zEstadoPedido, zTipoDescuento, zTipoPedido } from '../../types/dominio.js';
import { cargarPedido, incluirPedido, mapearPedido } from './servicio.js';

const zCrearPedido = z.object({
  tipo: zTipoPedido.default('MESA'),
  mesaId: z.string().optional().nullable(),
  comensales: z.number().int().min(1).max(60).default(2),
  notas: z.string().optional().nullable(),
  /** Pedido de formación: no factura, no toca caja y no cuenta en informes. */
  esPractica: z.boolean().default(false),
});

const zModificador = z.object({ nombre: z.string(), precioCent: z.number().int().default(0) });

const zLinea = z.object({
  productoId: z.string().optional().nullable(),
  // Linea libre (producto fuera de carta) si no viene productoId
  nombre: z.string().optional(),
  precioUnitCent: z.number().int().min(0).optional(),
  ivaTipo: z.number().int().optional(),
  cantidad: z.number().int().min(1).max(99).default(1),
  modificadores: z.array(zModificador).default([]),
  notas: z.string().optional().nullable(),
  curso: z.number().int().min(1).max(5).default(1),
});

export default async function rutasPedidos(app: FastifyInstance) {
  // -- Consulta -------------------------------------------------------------
  app.get('/', { preHandler: requierePermiso('pedidos.ver') }, async (req) => {
    const q = query(
      req,
      z.object({
        estado: zEstadoPedido.optional(),
        abiertos: z.coerce.boolean().default(false),
        mesaId: z.string().optional(),
        limite: z.coerce.number().int().min(1).max(200).default(50),
      }),
    );
    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: q.abiertos ? { in: ['ABIERTO', 'PARA_COBRAR'] } : q.estado,
        mesaId: q.mesaId,
      },
      orderBy: { abiertoEn: 'desc' },
      take: q.limite,
      include: incluirPedido,
    });
    return pedidos.map(mapearPedido);
  });

  app.get('/:id', { preHandler: requierePermiso('pedidos.ver') }, async (req) => {
    const { id } = params(req, zId);
    const p = await cargarPedido(id);
    if (!p) throw noEncontrado('Pedido');
    return mapearPedido(p);
  });

  /** Pedido abierto de una mesa: el atajo que usa el plano de sala. */
  app.get('/mesa/:id', { preHandler: requierePermiso('pedidos.ver') }, async (req) => {
    const { id } = params(req, zId);
    const p = await prisma.pedido.findFirst({
      where: { mesaId: id, estado: { in: ['ABIERTO', 'PARA_COBRAR'] } },
      include: incluirPedido,
    });
    return p ? mapearPedido(p) : null;
  });

  // -- Ciclo de vida --------------------------------------------------------
  app.post('/', { preHandler: requierePermiso('pedidos.crear') }, async (req) => {
    const datos = body(req, zCrearPedido);
    if (datos.tipo === 'MESA' && !datos.mesaId) throw invalido('Un pedido de mesa necesita mesa');

    if (datos.mesaId) {
      const abierto = await prisma.pedido.findFirst({
        where: { mesaId: datos.mesaId, estado: { in: ['ABIERTO', 'PARA_COBRAR'] } },
      });
      if (abierto) throw conflicto('Esa mesa ya tiene un pedido abierto');
    }

    const pedido = await prisma.$transaction(async (tx) => {
      const numero = await siguienteNumero(tx, 'pedido');
      const creado = await tx.pedido.create({
        data: {
          numero,
          tipo: datos.tipo,
          mesaId: datos.mesaId || null,
          comensales: datos.comensales,
          camareroId: req.usuario!.id,
          notas: datos.notas || null,
          esPractica: datos.esPractica,
        },
      });
      if (datos.mesaId) {
        await tx.mesa.update({ where: { id: datos.mesaId }, data: { estado: 'OCUPADA' } });
      }
      return tx.pedido.findUnique({ where: { id: creado.id }, include: incluirPedido });
    });

    emitir('sala', 'sala:recargar', {});
    return mapearPedido(pedido);
  });

  app.patch('/:id', { preHandler: requierePermiso('pedidos.crear') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(
      req,
      z.object({
        comensales: z.number().int().min(1).max(60).optional(),
        notas: z.string().optional().nullable(),
        estado: z.enum(['ABIERTO', 'PARA_COBRAR']).optional(),
      }),
    );
    const p = await prisma.pedido.findUnique({ where: { id } });
    if (!p) throw noEncontrado('Pedido');
    if (p.estado === 'COBRADO' || p.estado === 'ANULADO') {
      throw conflicto('El pedido ya está cerrado');
    }
    const actualizado = await prisma.pedido.update({
      where: { id },
      data: {
        comensales: datos.comensales,
        notas: datos.notas === undefined ? undefined : datos.notas || null,
        estado: datos.estado,
      },
      include: incluirPedido,
    });
    emitir('sala', 'pedido:actualizado', { id });
    return mapearPedido(actualizado);
  });

  app.post('/:id/anular', { preHandler: requierePermiso('pedidos.anular_linea') }, async (req) => {
    const { id } = params(req, zId);
    const { motivo } = body(req, z.object({ motivo: z.string().min(3) }));
    const p = await prisma.pedido.findUnique({ where: { id }, include: { pagos: true } });
    if (!p) throw noEncontrado('Pedido');
    if (p.estado === 'COBRADO') throw conflicto('Un pedido cobrado se anula con factura rectificativa');
    if (p.pagos.some((g) => g.estado === 'COMPLETADO')) {
      throw conflicto('El pedido tiene cobros registrados: anúlalos primero');
    }

    await prisma.$transaction(async (tx) => {
      await tx.lineaPedido.updateMany({
        where: { pedidoId: id, estado: { not: 'ANULADO' } },
        data: { estado: 'ANULADO', anuladaMotivo: motivo },
      });
      await tx.pedido.update({
        where: { id },
        data: { estado: 'ANULADO', anuladoEn: new Date(), anuladoMotivo: motivo, cerradoEn: new Date() },
      });
      await tx.prestamoJuego.updateMany({
        where: { pedidoId: id, estado: 'ACTIVO' },
        data: { estado: 'DEVUELTO', finEn: new Date() },
      });
      if (p.mesaId) {
        await tx.mesa.update({ where: { id: p.mesaId }, data: { estado: 'LIMPIEZA' } });
      }
    });

    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'PEDIDO_ANULADO',
      entidad: 'Pedido',
      entidadId: id,
      detalle: { numero: p.numero, motivo },
    });
    emitir('sala', 'sala:recargar', {});
    emitir('cocina', 'cocina:recargar', {});
    emitir('barra', 'cocina:recargar', {});
    return { ok: true };
  });

  // -- Lineas ---------------------------------------------------------------
  app.post('/:id/lineas', { preHandler: requierePermiso('pedidos.crear') }, async (req) => {
    const { id } = params(req, zId);
    const { lineas } = body(req, z.object({ lineas: z.array(zLinea).min(1) }));

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw noEncontrado('Pedido');
    if (pedido.estado !== 'ABIERTO' && pedido.estado !== 'PARA_COBRAR') {
      throw conflicto('El pedido no admite más líneas');
    }

    const productoIds = lineas.map((l) => l.productoId).filter(Boolean) as string[];
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      include: { categoria: true },
    });
    const mapaProductos = new Map(productos.map((p) => [p.id, p]));

    const datosLineas = lineas.map((l) => {
      const modificadorCent = l.modificadores.reduce((a, m) => a + m.precioCent, 0);
      if (l.productoId) {
        const prod = mapaProductos.get(l.productoId);
        if (!prod) throw noEncontrado(`Producto ${l.productoId}`);
        return {
          pedidoId: id,
          productoId: prod.id,
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          precioUnitCent: prod.precioCent,
          cantidad: l.cantidad,
          ivaTipo: prod.ivaTipo,
          modificadoresJson: l.modificadores.length ? JSON.stringify(l.modificadores) : null,
          modificadorCent,
          notas: l.notas || null,
          destino: prod.destino ?? prod.categoria.destino,
          curso: l.curso,
        };
      }
      if (!l.nombre || l.precioUnitCent === undefined) {
        throw invalido('Una línea libre necesita nombre y precio');
      }
      return {
        pedidoId: id,
        productoId: null,
        nombre: l.nombre,
        descripcion: null,
        precioUnitCent: l.precioUnitCent,
        cantidad: l.cantidad,
        ivaTipo: l.ivaTipo ?? 10,
        modificadoresJson: l.modificadores.length ? JSON.stringify(l.modificadores) : null,
        modificadorCent,
        notas: l.notas || null,
        destino: 'NINGUNO',
        curso: l.curso,
      };
    });

    await prisma.lineaPedido.createMany({ data: datosLineas });
    const actualizado = await cargarPedido(id);
    emitir('sala', 'pedido:actualizado', { id });
    return mapearPedido(actualizado);
  });

  app.patch('/:id/lineas/:lineaId', { preHandler: requierePermiso('pedidos.crear') }, async (req) => {
    const { id, lineaId } = params(req, z.object({ id: z.string(), lineaId: z.string() }));
    const datos = body(
      req,
      z.object({
        cantidad: z.number().int().min(1).max(99).optional(),
        notas: z.string().optional().nullable(),
        curso: z.number().int().min(1).max(5).optional(),
        invitada: z.boolean().optional(),
        descuentoTipo: zTipoDescuento.optional().nullable(),
        descuentoValor: z.number().int().min(0).optional(),
      }),
    );
    const linea = await prisma.lineaPedido.findUnique({ where: { id: lineaId } });
    if (!linea || linea.pedidoId !== id) throw noEncontrado('Línea');
    if (linea.estado === 'ANULADO') throw conflicto('La línea está anulada');

    if (datos.invitada !== undefined) exigirPermiso(req, 'pedidos.invitar');
    if (datos.descuentoTipo !== undefined || datos.descuentoValor !== undefined) {
      exigirPermiso(req, 'pedidos.descuento');
    }
    // Una vez en cocina, cambiar la cantidad exige re-enviar la comanda.
    if (datos.cantidad !== undefined && linea.estado !== 'PENDIENTE') {
      exigirPermiso(req, 'pedidos.anular_linea');
    }

    await prisma.lineaPedido.update({
      where: { id: lineaId },
      data: {
        cantidad: datos.cantidad,
        notas: datos.notas === undefined ? undefined : datos.notas || null,
        curso: datos.curso,
        invitada: datos.invitada,
        descuentoTipo: datos.descuentoTipo === undefined ? undefined : datos.descuentoTipo,
        descuentoValor: datos.descuentoValor,
      },
    });

    if (datos.invitada || datos.descuentoValor) {
      await auditar({
        usuarioId: req.usuario!.id,
        accion: datos.invitada ? 'LINEA_INVITADA' : 'LINEA_DESCUENTO',
        entidad: 'LineaPedido',
        entidadId: lineaId,
        detalle: { nombre: linea.nombre, ...datos },
      });
    }
    const actualizado = await cargarPedido(id);
    emitir('sala', 'pedido:actualizado', { id });
    return mapearPedido(actualizado);
  });

  app.delete(
    '/:id/lineas/:lineaId',
    { preHandler: requierePermiso('pedidos.crear') },
    async (req) => {
      const { id, lineaId } = params(req, z.object({ id: z.string(), lineaId: z.string() }));
      const { motivo } = body(req, z.object({ motivo: z.string().optional() }));
      const linea = await prisma.lineaPedido.findUnique({ where: { id: lineaId } });
      if (!linea || linea.pedidoId !== id) throw noEncontrado('Línea');

      if (linea.estado === 'PENDIENTE') {
        // Todavia no ha salido a cocina: se borra sin dejar rastro en el ticket.
        await prisma.lineaPedido.delete({ where: { id: lineaId } });
      } else {
        // Ya enviada: se anula con motivo, nunca se borra (queda en auditoria).
        exigirPermiso(req, 'pedidos.anular_linea');
        if (!motivo) throw invalido('Anular una línea ya enviada requiere motivo');
        await prisma.lineaPedido.update({
          where: { id: lineaId },
          data: { estado: 'ANULADO', anuladaMotivo: motivo },
        });
        await auditar({
          usuarioId: req.usuario!.id,
          accion: 'LINEA_ANULADA',
          entidad: 'LineaPedido',
          entidadId: lineaId,
          detalle: { nombre: linea.nombre, cantidad: linea.cantidad, motivo },
        });
        emitirDestino(linea.destino, 'cocina:recargar', {});
      }
      const actualizado = await cargarPedido(id);
      emitir('sala', 'pedido:actualizado', { id });
      return mapearPedido(actualizado);
    },
  );

  /**
   * Envia a cocina y barra las lineas pendientes: crea un ticket por destino
   * y numera la ronda. Es la accion "Enviar comanda" del TPV.
   */
  app.post('/:id/enviar', { preHandler: requierePermiso('pedidos.crear') }, async (req) => {
    const { id } = params(req, zId);
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { lineas: { where: { estado: 'PENDIENTE' } }, tickets: true, mesa: true },
    });
    if (!pedido) throw noEncontrado('Pedido');
    const pendientes = pedido.lineas.filter((l) => l.destino !== 'NINGUNO');
    const soloDirectas = pedido.lineas.filter((l) => l.destino === 'NINGUNO');

    if (pedido.lineas.length === 0) throw invalido('No hay líneas pendientes de enviar');

    const ronda = pedido.tickets.length
      ? Math.max(...pedido.tickets.map((t) => t.numeroRonda)) + 1
      : 1;

    const ticketsCreados = await prisma.$transaction(async (tx) => {
      const creados = [];
      for (const destino of ['COCINA', 'BARRA'] as const) {
        const lineas = pendientes.filter((l) => l.destino === destino);
        if (!lineas.length) continue;
        const ticket = await tx.ticketCocina.create({
          data: { pedidoId: id, destino, numeroRonda: ronda },
        });
        await tx.lineaPedido.updateMany({
          where: { id: { in: lineas.map((l) => l.id) } },
          data: { estado: 'ENVIADO', enviadoEn: new Date(), ticketId: ticket.id },
        });
        creados.push({ ...ticket, lineas: lineas.length });
      }
      // Lo que no pasa por cocina (p.ej. el cover) se da por servido.
      if (soloDirectas.length) {
        await tx.lineaPedido.updateMany({
          where: { id: { in: soloDirectas.map((l) => l.id) } },
          data: { estado: 'SERVIDO', enviadoEn: new Date() },
        });
      }
      return creados;
    });

    for (const t of ticketsCreados) emitirDestino(t.destino, 'ticket:nuevo', { ticketId: t.id });
    emitir('sala', 'pedido:actualizado', { id });

    const actualizado = await cargarPedido(id);
    return { pedido: mapearPedido(actualizado), tickets: ticketsCreados, ronda };
  });

  // -- Descuento de pedido --------------------------------------------------
  app.post('/:id/descuento', { preHandler: requierePermiso('pedidos.descuento') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(
      req,
      z.object({
        tipo: zTipoDescuento.nullable(),
        valor: z.number().int().min(0).default(0),
        motivo: z.string().optional().nullable(),
      }),
    );
    const p = await prisma.pedido.findUnique({ where: { id } });
    if (!p) throw noEncontrado('Pedido');
    if (p.estado === 'COBRADO') throw conflicto('El pedido ya está cobrado');

    await prisma.pedido.update({
      where: { id },
      data: {
        descuentoTipo: datos.tipo,
        descuentoValor: datos.tipo ? datos.valor : 0,
        descuentoMotivo: datos.motivo || null,
      },
    });
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'PEDIDO_DESCUENTO',
      entidad: 'Pedido',
      entidadId: id,
      detalle: datos,
    });
    return mapearPedido(await cargarPedido(id));
  });

  // -- Transferencias y division --------------------------------------------
  /** Mueve el pedido entero a otra mesa. */
  app.post('/:id/mover', { preHandler: requierePermiso('pedidos.transferir') }, async (req) => {
    const { id } = params(req, zId);
    const { mesaId } = body(req, z.object({ mesaId: z.string() }));
    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw noEncontrado('Pedido');
    if (pedido.estado === 'COBRADO' || pedido.estado === 'ANULADO') {
      throw conflicto('El pedido ya está cerrado');
    }
    const ocupada = await prisma.pedido.findFirst({
      where: { mesaId, estado: { in: ['ABIERTO', 'PARA_COBRAR'] } },
    });
    if (ocupada) throw conflicto('La mesa destino ya tiene un pedido abierto');

    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({ where: { id }, data: { mesaId } });
      await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'OCUPADA' } });
      if (pedido.mesaId && pedido.mesaId !== mesaId) {
        await tx.mesa.update({ where: { id: pedido.mesaId }, data: { estado: 'LIMPIEZA' } });
      }
      await tx.prestamoJuego.updateMany({ where: { pedidoId: id, estado: 'ACTIVO' }, data: { mesaId } });
    });
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'PEDIDO_MOVIDO',
      entidad: 'Pedido',
      entidadId: id,
      detalle: { de: pedido.mesaId, a: mesaId },
    });
    emitir('sala', 'sala:recargar', {});
    return mapearPedido(await cargarPedido(id));
  });

  /**
   * Separa lineas a otro pedido (dividir cuenta). Si no se indica pedido
   * destino se crea uno nuevo, opcionalmente en otra mesa.
   */
  app.post('/:id/dividir', { preHandler: requierePermiso('pedidos.transferir') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(
      req,
      z.object({
        lineaIds: z.array(z.string()).min(1),
        pedidoDestinoId: z.string().optional(),
        mesaId: z.string().optional(),
        comensales: z.number().int().min(1).default(1),
      }),
    );
    const origen = await prisma.pedido.findUnique({ where: { id }, include: { lineas: true } });
    if (!origen) throw noEncontrado('Pedido');
    if (origen.estado === 'COBRADO' || origen.estado === 'ANULADO') {
      throw conflicto('El pedido ya está cerrado');
    }
    const suyas = origen.lineas.filter((l) => datos.lineaIds.includes(l.id));
    if (suyas.length !== datos.lineaIds.length) {
      throw invalido('Alguna línea no pertenece a este pedido');
    }
    if (suyas.length === origen.lineas.filter((l) => l.estado !== 'ANULADO').length) {
      throw invalido('No puedes mover todas las líneas: mueve el pedido entero');
    }

    const destino = await prisma.$transaction(async (tx) => {
      let pedidoDestino;
      if (datos.pedidoDestinoId) {
        pedidoDestino = await tx.pedido.findUnique({ where: { id: datos.pedidoDestinoId } });
        if (!pedidoDestino) throw noEncontrado('Pedido destino');
        if (pedidoDestino.estado === 'COBRADO' || pedidoDestino.estado === 'ANULADO') {
          throw conflicto('El pedido destino ya está cerrado');
        }
      } else {
        const numero = await siguienteNumero(tx, 'pedido');
        pedidoDestino = await tx.pedido.create({
          data: {
            numero,
            tipo: datos.mesaId ? 'MESA' : origen.tipo,
            mesaId: datos.mesaId ?? null,
            comensales: datos.comensales,
            camareroId: req.usuario!.id,
            notas: `Separado del pedido #${origen.numero}`,
          },
        });
        if (datos.mesaId) {
          await tx.mesa.update({ where: { id: datos.mesaId }, data: { estado: 'OCUPADA' } });
        }
      }
      await tx.lineaPedido.updateMany({
        where: { id: { in: datos.lineaIds } },
        data: { pedidoId: pedidoDestino.id },
      });
      return pedidoDestino;
    });

    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'PEDIDO_DIVIDIDO',
      entidad: 'Pedido',
      entidadId: id,
      detalle: { lineas: datos.lineaIds.length, destino: destino.id },
    });
    emitir('sala', 'sala:recargar', {});
    return {
      origen: mapearPedido(await cargarPedido(id)),
      destino: mapearPedido(await cargarPedido(destino.id)),
    };
  });

  /**
   * Anade el cover fee del local: 4 EUR por persona consumiendo, 7 EUR si
   * solo se juega. Es el cargo propio del board game cafe.
   */
  app.post('/:id/cover', { preHandler: requierePermiso('pedidos.crear') }, async (req) => {
    const { id } = params(req, zId);
    const { modalidad, personas } = body(
      req,
      z.object({
        modalidad: z.enum(['CONSUMIENDO', 'SOLO_JUGAR']),
        personas: z.number().int().min(1).max(60).optional(),
      }),
    );
    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw noEncontrado('Pedido');

    const codigo = modalidad === 'CONSUMIENDO' ? 'COVER_CONSUMIENDO' : 'COVER_SOLO_JUGAR';
    const producto = await prisma.producto.findFirst({ where: { codigoRapido: codigo } });
    if (!producto) throw noEncontrado(`Producto de cover (${codigo})`);

    const cantidad = personas ?? pedido.comensales;
    await prisma.lineaPedido.create({
      data: {
        pedidoId: id,
        productoId: producto.id,
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precioUnitCent: producto.precioCent,
        cantidad,
        ivaTipo: producto.ivaTipo,
        destino: 'NINGUNO',
        estado: 'SERVIDO',
        enviadoEn: new Date(),
      },
    });
    emitir('sala', 'pedido:actualizado', { id });
    return mapearPedido(await cargarPedido(id));
  });
}
