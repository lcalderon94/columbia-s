import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { body, params, zId } from '../../lib/http.js';
import { requiereSesion, requierePermiso } from '../../lib/auth.js';
import { auditar } from '../../lib/auditoria.js';
import { emitir } from '../../lib/realtime.js';

/**
 * Guías disponibles. El orden es el que se recomienda a un empleado nuevo:
 * primero moverse por el programa, luego comandar, y por último lo que toca
 * dinero, que es donde más se falla.
 */
export const GUIAS = [
  { id: 'primeros-pasos', titulo: 'Primeros pasos', minutos: 2, esencial: false },
  { id: 'sala', titulo: 'La sala y las mesas', minutos: 2, esencial: false },
  { id: 'comanda', titulo: 'Tomar una comanda', minutos: 4, esencial: true },
  { id: 'cocina', titulo: 'Cocina y barra', minutos: 2, esencial: false },
  { id: 'cobro', titulo: 'Cobrar una cuenta', minutos: 6, esencial: true },
  { id: 'caja-abrir', titulo: 'Abrir la caja', minutos: 2, esencial: true },
  { id: 'caja-cerrar', titulo: 'Cerrar la caja (arqueo)', minutos: 5, esencial: true },
  { id: 'ludoteca', titulo: 'Juegos y cover', minutos: 2, esencial: false },
  { id: 'reservas', titulo: 'Reservas', minutos: 2, esencial: false },
] as const;

export default async function rutasFormacion(app: FastifyInstance) {
  /** Guías disponibles y cuáles lleva completadas quien pregunta. */
  app.get('/', { preHandler: requiereSesion }, async (req) => {
    const hechas = await prisma.progresoFormacion.findMany({
      where: { usuarioId: req.usuario!.id },
      select: { guia: true, completadaEn: true },
    });
    const mapa = new Map(hechas.map((h) => [h.guia, h.completadaEn]));

    const guias = GUIAS.map((g) => ({
      ...g,
      completada: mapa.has(g.id),
      completadaEn: mapa.get(g.id) ?? null,
    }));
    const esenciales = guias.filter((g) => g.esencial);

    return {
      guias,
      // Se considera formado cuando tiene hechas las que tocan dinero.
      listo: esenciales.every((g) => g.completada),
      pendientesEsenciales: esenciales.filter((g) => !g.completada).map((g) => g.id),
      completadas: guias.filter((g) => g.completada).length,
      total: guias.length,
    };
  });

  app.post('/:id/completada', { preHandler: requiereSesion }, async (req) => {
    const { id } = params(req, zId);
    if (!GUIAS.some((g) => g.id === id)) {
      return { ok: false, motivo: 'Esa guía no existe' };
    }
    await prisma.progresoFormacion.upsert({
      where: { usuarioId_guia: { usuarioId: req.usuario!.id, guia: id } },
      create: { usuarioId: req.usuario!.id, guia: id },
      update: { completadaEn: new Date() },
    });
    return { ok: true };
  });

  /** Vuelve a empezar la formación desde cero. */
  app.delete('/progreso', { preHandler: requiereSesion }, async (req) => {
    await prisma.progresoFormacion.deleteMany({ where: { usuarioId: req.usuario!.id } });
    return { ok: true };
  });

  /** Cuántos datos de prácticas hay dando vueltas ahora mismo. */
  app.get('/practicas', { preHandler: requiereSesion }, async () => {
    const pedidos = await prisma.pedido.findMany({
      where: { esPractica: true },
      select: { id: true, numero: true, estado: true, mesaId: true, abiertoEn: true },
    });
    return { pedidos, total: pedidos.length };
  });

  /**
   * Borra todo lo creado durante las prácticas.
   *
   * Es seguro por construcción: un pedido de prácticas nunca emitió factura
   * ni se colgó de una sesión de caja, así que no hay nada contable que
   * pueda quedar descuadrado ni ningún número de serie que se pierda.
   */
  app.delete('/practicas', { preHandler: requierePermiso('pedidos.crear') }, async (req) => {
    const pedidos = await prisma.pedido.findMany({
      where: { esPractica: true },
      select: { id: true, mesaId: true },
    });
    if (pedidos.length === 0) return { ok: true, borrados: 0, mesasLiberadas: 0 };

    const ids = pedidos.map((p) => p.id);
    const mesaIds = [...new Set(pedidos.map((p) => p.mesaId).filter(Boolean))] as string[];

    // Salvaguarda: si algo de prácticas hubiese llegado a facturar, no se
    // borra nada y se avisa, en vez de dejar una factura huérfana.
    const conFactura = await prisma.factura.count({ where: { pedidoId: { in: ids } } });
    if (conFactura > 0) {
      return {
        ok: false,
        motivo: `Hay ${conFactura} factura(s) ligadas a pedidos de prácticas. No se borra nada: avisa al administrador.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.prestamoJuego.updateMany({
        where: { pedidoId: { in: ids }, estado: 'ACTIVO' },
        data: { estado: 'DEVUELTO', finEn: new Date() },
      });
      await tx.juego.updateMany({
        where: { prestamos: { some: { pedidoId: { in: ids } } }, estado: 'PRESTADO' },
        data: { estado: 'DISPONIBLE' },
      });
      await tx.prestamoJuego.deleteMany({ where: { pedidoId: { in: ids } } });
      await tx.pago.deleteMany({ where: { pedidoId: { in: ids } } });
      // Las líneas y los tickets caen solos con el pedido (onDelete: Cascade)
      await tx.pedido.deleteMany({ where: { id: { in: ids } } });

      // Las mesas que solo estaban ocupadas por prácticas vuelven a estar libres
      for (const mesaId of mesaIds) {
        const sigueOcupada = await tx.pedido.count({
          where: { mesaId, estado: { in: ['ABIERTO', 'PARA_COBRAR'] } },
        });
        if (sigueOcupada === 0) {
          await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'LIBRE' } });
        }
      }
    });

    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'PRACTICAS_BORRADAS',
      entidad: 'Pedido',
      detalle: { pedidos: ids.length, mesas: mesaIds.length },
    });
    emitir('sala', 'sala:recargar', {});
    emitir('cocina', 'cocina:recargar', {});
    emitir('barra', 'cocina:recargar', {});

    return { ok: true, borrados: ids.length, mesasLiberadas: mesaIds.length };
  });
}
