import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, type Tx } from '../../lib/db.js';
import { body, params, query, zId } from '../../lib/http.js';
import { requierePermiso } from '../../lib/auth.js';
import { conflicto, noEncontrado, invalido } from '../../lib/errores.js';
import { auditar } from '../../lib/auditoria.js';
import { emitir } from '../../lib/realtime.js';
import { siguienteNumero } from '../../lib/contador.js';
import { zTipoMovimientoCaja } from '../../types/dominio.js';

/** Valores de monedas y billetes en centimos, para el arqueo. */
export const DENOMINACIONES = [
  50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1,
];

const zArqueo = z.record(z.string(), z.number().int().min(0));

/**
 * Resumen economico de una sesion de caja.
 * El saldo teorico en efectivo es: fondo inicial + cobros en efectivo
 * + entradas - salidas. Las tarjetas no pasan por el cajon.
 */
async function resumenSesion(sesionId: string, tx: Tx = prisma) {
  const sesion = await tx.sesionCaja.findUnique({
    where: { id: sesionId },
    include: {
      abiertaPor: { select: { id: true, nombre: true } },
      cerradaPor: { select: { id: true, nombre: true } },
      movimientos: { orderBy: { creadoEn: 'asc' }, include: { usuario: { select: { nombre: true } } } },
      pagos: { where: { estado: 'COMPLETADO', esPractica: false } },
    },
  });
  if (!sesion) throw noEncontrado('Sesión de caja');

  const porMetodo = new Map<string, { importeCent: number; propinaCent: number; num: number }>();
  for (const p of sesion.pagos) {
    const acc = porMetodo.get(p.metodo) ?? { importeCent: 0, propinaCent: 0, num: 0 };
    acc.importeCent += p.importeCent;
    acc.propinaCent += p.propinaCent;
    acc.num += 1;
    porMetodo.set(p.metodo, acc);
  }

  const efectivoCobradoCent = porMetodo.get('EFECTIVO')?.importeCent ?? 0;
  const propinaEfectivoCent = porMetodo.get('EFECTIVO')?.propinaCent ?? 0;

  const entradasCent = sesion.movimientos
    .filter((m) => ['ENTRADA'].includes(m.tipo))
    .reduce((a, m) => a + m.importeCent, 0);
  const salidasCent = sesion.movimientos
    .filter((m) => ['SALIDA', 'RETIRADA', 'GASTO'].includes(m.tipo))
    .reduce((a, m) => a + m.importeCent, 0);

  const saldoTeoricoCent =
    sesion.saldoInicialCent + efectivoCobradoCent + propinaEfectivoCent + entradasCent - salidasCent;

  const pedidosCobrados = await tx.pedido.count({
    where: { sesionCajaId: sesionId, estado: 'COBRADO' },
  });
  const ventaTotalCent = sesion.pagos.reduce((a, p) => a + p.importeCent, 0);

  // Lo que impide cerrar la caja. Se devuelve con su mesa e importe para que
  // la pantalla pueda llevar al camarero directo a cobrarlos, en vez de
  // dejarle con un aviso sin saber cuál es ni dónde está.
  const pendientes = await tx.pedido.findMany({
    where: { estado: { in: ['ABIERTO', 'PARA_COBRAR'] }, esPractica: false },
    orderBy: { abiertoEn: 'asc' },
    include: {
      mesa: { select: { nombre: true } },
      camarero: { select: { nombre: true } },
      lineas: { where: { estado: { not: 'ANULADO' } } },
    },
  });

  return {
    id: sesion.id,
    numero: sesion.numero,
    estado: sesion.estado,
    abiertaEn: sesion.abiertaEn,
    abiertaPor: sesion.abiertaPor,
    cerradaEn: sesion.cerradaEn,
    cerradaPor: sesion.cerradaPor,
    saldoInicialCent: sesion.saldoInicialCent,
    saldoFinalContadoCent: sesion.saldoFinalContadoCent,
    descuadreCent: sesion.descuadreCent,
    notas: sesion.notas,
    desgloseArqueo: sesion.desgloseArqueoJson ? JSON.parse(sesion.desgloseArqueoJson) : null,
    totales: {
      ventaTotalCent,
      efectivoCobradoCent,
      propinaTotalCent: sesion.pagos.reduce((a, p) => a + p.propinaCent, 0),
      entradasCent,
      salidasCent,
      saldoTeoricoCent,
      pedidosCobrados,
      ticketMedioCent: pedidosCobrados ? Math.round(ventaTotalCent / pedidosCobrados) : 0,
    },
    pedidosPendientes: pendientes.map((p) => ({
      id: p.id,
      numero: p.numero,
      mesa: p.mesa?.nombre ?? p.tipo,
      camarero: p.camarero?.nombre ?? null,
      abiertoEn: p.abiertoEn,
      lineas: p.lineas.length,
      totalCent: p.lineas.reduce(
        (a, l) => (l.invitada ? a : a + (l.precioUnitCent + l.modificadorCent) * l.cantidad),
        0,
      ),
    })),
    porMetodo: [...porMetodo.entries()].map(([metodo, v]) => ({ metodo, ...v })),
    movimientos: sesion.movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      importeCent: m.importeCent,
      motivo: m.motivo,
      usuario: m.usuario?.nombre ?? null,
      creadoEn: m.creadoEn,
    })),
  };
}

export default async function rutasCaja(app: FastifyInstance) {
  app.get('/denominaciones', { preHandler: requierePermiso('caja.ver') }, async () => DENOMINACIONES);

  /** Caja abierta ahora mismo, con su resumen en vivo (informe X). */
  app.get('/actual', { preHandler: requierePermiso('caja.ver') }, async () => {
    const sesion = await prisma.sesionCaja.findFirst({
      where: { estado: 'ABIERTA' },
      orderBy: { abiertaEn: 'desc' },
    });
    if (!sesion) return null;
    return resumenSesion(sesion.id);
  });

  app.get('/sesiones', { preHandler: requierePermiso('caja.ver') }, async (req) => {
    const q = query(req, z.object({ limite: z.coerce.number().int().min(1).max(200).default(30) }));
    const sesiones = await prisma.sesionCaja.findMany({
      orderBy: { abiertaEn: 'desc' },
      take: q.limite,
      include: {
        abiertaPor: { select: { nombre: true } },
        cerradaPor: { select: { nombre: true } },
        pagos: { where: { estado: 'COMPLETADO', esPractica: false }, select: { importeCent: true } },
      },
    });
    return sesiones.map((s) => ({
      id: s.id,
      numero: s.numero,
      estado: s.estado,
      abiertaEn: s.abiertaEn,
      cerradaEn: s.cerradaEn,
      abiertaPor: s.abiertaPor.nombre,
      cerradaPor: s.cerradaPor?.nombre ?? null,
      saldoInicialCent: s.saldoInicialCent,
      saldoFinalContadoCent: s.saldoFinalContadoCent,
      descuadreCent: s.descuadreCent,
      ventaTotalCent: s.pagos.reduce((a, p) => a + p.importeCent, 0),
    }));
  });

  app.get('/sesiones/:id', { preHandler: requierePermiso('caja.ver') }, async (req) => {
    const { id } = params(req, zId);
    return resumenSesion(id);
  });

  app.post('/abrir', { preHandler: requierePermiso('caja.abrir') }, async (req) => {
    const { saldoInicialCent, notas } = body(
      req,
      z.object({
        saldoInicialCent: z.number().int().min(0).default(0),
        notas: z.string().optional().nullable(),
      }),
    );
    const abierta = await prisma.sesionCaja.findFirst({ where: { estado: 'ABIERTA' } });
    if (abierta) throw conflicto(`Ya hay una caja abierta (nº ${abierta.numero})`);

    const sesion = await prisma.$transaction(async (tx) => {
      const numero = await siguienteNumero(tx, 'caja');
      const creada = await tx.sesionCaja.create({
        data: {
          numero,
          abiertaPorId: req.usuario!.id,
          saldoInicialCent,
          notas: notas || null,
        },
      });
      await tx.movimientoCaja.create({
        data: {
          sesionCajaId: creada.id,
          tipo: 'APERTURA',
          importeCent: saldoInicialCent,
          motivo: 'Fondo de caja inicial',
          usuarioId: req.usuario!.id,
        },
      });
      return creada;
    });

    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'CAJA_ABIERTA',
      entidad: 'SesionCaja',
      entidadId: sesion.id,
      detalle: { numero: sesion.numero, saldoInicialCent },
    });
    emitir('caja', 'caja:actualizada', {});
    return resumenSesion(sesion.id);
  });

  /**
   * Cierre Z: se cuenta el cajon, se compara con el teorico y se deja
   * registrado el descuadre. A partir de aqui la sesion es historico.
   */
  app.post('/cerrar', { preHandler: requierePermiso('caja.cerrar') }, async (req) => {
    const datos = body(
      req,
      z.object({
        /** { "500": 3, "200": 10, ... } -> unidades por denominacion en centimos */
        arqueo: zArqueo.optional(),
        saldoFinalContadoCent: z.number().int().min(0).optional(),
        notas: z.string().optional().nullable(),
        retirarSobranteCent: z.number().int().min(0).default(0),
      }),
    );
    const sesion = await prisma.sesionCaja.findFirst({ where: { estado: 'ABIERTA' } });
    if (!sesion) throw conflicto('No hay ninguna caja abierta');

    // Los pedidos de formación no cuentan: no llevan dinero real dentro.
    const abiertos = await prisma.pedido.findMany({
      where: { estado: { in: ['ABIERTO', 'PARA_COBRAR'] }, esPractica: false },
      include: { mesa: { select: { nombre: true } } },
    });
    if (abiertos.length > 0) {
      const donde = abiertos
        .map((p) => (p.mesa ? `mesa ${p.mesa.nombre}` : `pedido #${p.numero}`))
        .join(', ');
      throw conflicto(
        `Queda dinero sin cobrar en ${donde}. Cóbralo o anúlalo antes de cerrar la caja.`,
      );
    }

    const contadoCent =
      datos.saldoFinalContadoCent ??
      (datos.arqueo
        ? Object.entries(datos.arqueo).reduce((a, [den, uds]) => a + Number(den) * uds, 0)
        : undefined);
    if (contadoCent === undefined) {
      throw invalido('Indica el arqueo por denominaciones o el total contado');
    }

    const resumen = await resumenSesion(sesion.id);
    const teoricoCent = resumen.totales.saldoTeoricoCent;
    const descuadreCent = contadoCent - teoricoCent;

    const cerrada = await prisma.$transaction(async (tx) => {
      if (datos.retirarSobranteCent > 0) {
        await tx.movimientoCaja.create({
          data: {
            sesionCajaId: sesion.id,
            tipo: 'RETIRADA',
            importeCent: datos.retirarSobranteCent,
            motivo: 'Retirada al cierre',
            usuarioId: req.usuario!.id,
          },
        });
      }
      await tx.movimientoCaja.create({
        data: {
          sesionCajaId: sesion.id,
          tipo: 'CIERRE',
          importeCent: contadoCent,
          motivo: `Cierre de caja nº ${sesion.numero}`,
          usuarioId: req.usuario!.id,
        },
      });
      return tx.sesionCaja.update({
        where: { id: sesion.id },
        data: {
          estado: 'CERRADA',
          cerradaEn: new Date(),
          cerradaPorId: req.usuario!.id,
          saldoFinalContadoCent: contadoCent,
          saldoFinalTeoricoCent: teoricoCent,
          descuadreCent,
          desgloseArqueoJson: datos.arqueo ? JSON.stringify(datos.arqueo) : null,
          resumenJson: JSON.stringify(resumen.totales),
          notas: datos.notas ?? sesion.notas,
        },
      });
    });

    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'CAJA_CERRADA',
      entidad: 'SesionCaja',
      entidadId: sesion.id,
      detalle: { numero: sesion.numero, contadoCent, teoricoCent, descuadreCent },
    });
    emitir('caja', 'caja:actualizada', {});
    return { ...(await resumenSesion(cerrada.id)), descuadreCent, saldoFinalTeoricoCent: teoricoCent };
  });

  /** Entradas y salidas de dinero que no son ventas (gastos, cambio, retiradas). */
  app.post('/movimientos', { preHandler: requierePermiso('caja.movimiento') }, async (req) => {
    const datos = body(
      req,
      z.object({
        tipo: zTipoMovimientoCaja.refine(
          (t) => ['ENTRADA', 'SALIDA', 'RETIRADA', 'GASTO'].includes(t),
          'Tipo de movimiento no permitido manualmente',
        ),
        importeCent: z.number().int().min(1),
        motivo: z.string().min(3),
      }),
    );
    const sesion = await prisma.sesionCaja.findFirst({ where: { estado: 'ABIERTA' } });
    if (!sesion) throw conflicto('No hay ninguna caja abierta');

    const mov = await prisma.movimientoCaja.create({
      data: { ...datos, sesionCajaId: sesion.id, usuarioId: req.usuario!.id },
    });
    await auditar({
      usuarioId: req.usuario!.id,
      accion: `CAJA_${datos.tipo}`,
      entidad: 'MovimientoCaja',
      entidadId: mov.id,
      detalle: datos,
    });
    emitir('caja', 'caja:actualizada', {});
    return mov;
  });
}
