import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { body, params, query, zId } from '../../lib/http.js';
import { requierePermiso } from '../../lib/auth.js';
import { noEncontrado } from '../../lib/errores.js';
import { emitir, emitirDestino } from '../../lib/realtime.js';
import { zDestino, zEstadoTicket } from '../../types/dominio.js';

const incluirTicket = {
  lineas: { orderBy: { creadoEn: 'asc' as const } },
  pedido: {
    include: {
      mesa: { select: { nombre: true, zona: { select: { nombre: true } } } },
      camarero: { select: { nombre: true, color: true } },
    },
  },
};

function mapearTicket(t: any) {
  const activas = t.lineas.filter((l: any) => l.estado !== 'ANULADO');
  return {
    id: t.id,
    destino: t.destino,
    numeroRonda: t.numeroRonda,
    estado: t.estado,
    creadoEn: t.creadoEn,
    iniciadoEn: t.iniciadoEn,
    listoEn: t.listoEn,
    entregadoEn: t.entregadoEn,
    /** Minutos que lleva esperando: lo que colorea la tarjeta en pantalla. */
    minutosEspera: Math.floor((Date.now() - new Date(t.creadoEn).getTime()) / 60000),
    pedido: {
      id: t.pedido.id,
      numero: t.pedido.numero,
      tipo: t.pedido.tipo,
      comensales: t.pedido.comensales,
      notas: t.pedido.notas,
      mesa: t.pedido.mesa?.nombre ?? null,
      zona: t.pedido.mesa?.zona?.nombre ?? null,
      camarero: t.pedido.camarero?.nombre ?? null,
    },
    lineas: activas.map((l: any) => ({
      id: l.id,
      nombre: l.nombre,
      cantidad: l.cantidad,
      notas: l.notas,
      curso: l.curso,
      estado: l.estado,
      modificadores: l.modificadoresJson ? JSON.parse(l.modificadoresJson) : [],
    })),
    anuladas: t.lineas
      .filter((l: any) => l.estado === 'ANULADO')
      .map((l: any) => ({ id: l.id, nombre: l.nombre, cantidad: l.cantidad })),
  };
}

export default async function rutasCocina(app: FastifyInstance) {
  /** Cola de trabajo de una pantalla (cocina o barra). */
  app.get('/', { preHandler: requierePermiso('cocina.ver') }, async (req) => {
    const q = query(
      req,
      z.object({
        destino: zDestino.default('COCINA'),
        incluirEntregados: z.coerce.boolean().default(false),
      }),
    );
    const tickets = await prisma.ticketCocina.findMany({
      where: {
        destino: q.destino,
        estado: q.incluirEntregados ? undefined : { in: ['NUEVO', 'EN_PREPARACION', 'LISTO'] },
        pedido: { estado: { not: 'ANULADO' } },
      },
      orderBy: { creadoEn: 'asc' },
      take: 80,
      include: incluirTicket,
    });
    const mapeados = tickets.map(mapearTicket).filter((t) => t.lineas.length > 0);
    return {
      tickets: mapeados,
      resumen: {
        nuevos: mapeados.filter((t) => t.estado === 'NUEVO').length,
        enPreparacion: mapeados.filter((t) => t.estado === 'EN_PREPARACION').length,
        listos: mapeados.filter((t) => t.estado === 'LISTO').length,
        esperaMaxMin: mapeados.reduce((a, t) => Math.max(a, t.minutosEspera), 0),
      },
    };
  });

  app.get('/:id', { preHandler: requierePermiso('cocina.ver') }, async (req) => {
    const { id } = params(req, zId);
    const t = await prisma.ticketCocina.findUnique({ where: { id }, include: incluirTicket });
    if (!t) throw noEncontrado('Ticket');
    return mapearTicket(t);
  });

  /**
   * Avanza el ticket. Cada estado arrastra el de sus lineas para que el
   * camarero vea en el TPV lo mismo que la pantalla de cocina.
   */
  app.post('/:id/estado', { preHandler: requierePermiso('cocina.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const { estado } = body(req, z.object({ estado: zEstadoTicket }));
    const ticket = await prisma.ticketCocina.findUnique({ where: { id } });
    if (!ticket) throw noEncontrado('Ticket');

    const ahora = new Date();
    const estadoLinea =
      estado === 'NUEVO'
        ? 'ENVIADO'
        : estado === 'EN_PREPARACION'
          ? 'EN_PREPARACION'
          : estado === 'LISTO'
            ? 'LISTO'
            : 'SERVIDO';

    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.lineaPedido.updateMany({
        where: { ticketId: id, estado: { not: 'ANULADO' } },
        data: { estado: estadoLinea },
      });
      return tx.ticketCocina.update({
        where: { id },
        data: {
          estado,
          iniciadoEn: estado === 'EN_PREPARACION' ? (ticket.iniciadoEn ?? ahora) : ticket.iniciadoEn,
          listoEn: estado === 'LISTO' ? ahora : ticket.listoEn,
          entregadoEn: estado === 'ENTREGADO' ? ahora : ticket.entregadoEn,
        },
        include: incluirTicket,
      });
    });

    emitirDestino(ticket.destino, 'ticket:actualizado', { ticketId: id, estado });
    emitir('sala', 'pedido:actualizado', { id: ticket.pedidoId });
    return mapearTicket(actualizado);
  });

  /** Marca una sola linea como lista (platos que salen sueltos). */
  app.post('/lineas/:id/estado', { preHandler: requierePermiso('cocina.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const { estado } = body(
      req,
      z.object({ estado: z.enum(['EN_PREPARACION', 'LISTO', 'SERVIDO']) }),
    );
    const linea = await prisma.lineaPedido.findUnique({ where: { id } });
    if (!linea) throw noEncontrado('Línea');

    await prisma.lineaPedido.update({ where: { id }, data: { estado } });

    // Si todas las lineas del ticket estan listas, el ticket tambien lo esta.
    if (linea.ticketId) {
      const hermanas = await prisma.lineaPedido.findMany({
        where: { ticketId: linea.ticketId, estado: { not: 'ANULADO' } },
      });
      const todasListas = hermanas.every((l) => l.estado === 'LISTO' || l.estado === 'SERVIDO');
      if (todasListas) {
        await prisma.ticketCocina.update({
          where: { id: linea.ticketId },
          data: { estado: 'LISTO', listoEn: new Date() },
        });
      }
      emitirDestino(linea.destino, 'ticket:actualizado', { ticketId: linea.ticketId });
    }
    emitir('sala', 'pedido:actualizado', { id: linea.pedidoId });
    return { ok: true };
  });

  /** Tiempos medios de servicio, para el informe de cocina. */
  app.get('/rendimiento', { preHandler: requierePermiso('informes.ver') }, async (req) => {
    const q = query(
      req,
      z.object({
        desde: z.coerce.date().optional(),
        hasta: z.coerce.date().optional(),
      }),
    );
    const tickets = await prisma.ticketCocina.findMany({
      where: {
        creadoEn: { gte: q.desde, lte: q.hasta },
        listoEn: { not: null },
      },
      select: { destino: true, creadoEn: true, listoEn: true, entregadoEn: true },
    });
    const porDestino = ['COCINA', 'BARRA'].map((destino) => {
      const suyos = tickets.filter((t) => t.destino === destino);
      const minutos = suyos.map(
        (t) => (new Date(t.listoEn!).getTime() - new Date(t.creadoEn).getTime()) / 60000,
      );
      return {
        destino,
        tickets: suyos.length,
        medioMin: minutos.length ? +(minutos.reduce((a, b) => a + b, 0) / minutos.length).toFixed(1) : 0,
        maxMin: minutos.length ? +Math.max(...minutos).toFixed(1) : 0,
      };
    });
    return { porDestino, total: tickets.length };
  });
}
