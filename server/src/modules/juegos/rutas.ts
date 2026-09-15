import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { body, params, query, zId } from '../../lib/http.js';
import { requierePermiso } from '../../lib/auth.js';
import { conflicto, noEncontrado } from '../../lib/errores.js';
import { emitir } from '../../lib/realtime.js';
import { zEstadoJuego } from '../../types/dominio.js';

const zJuego = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  minJugadores: z.number().int().min(1).default(2),
  maxJugadores: z.number().int().min(1).default(4),
  duracionMin: z.number().int().min(5).default(45),
  complejidad: z.number().int().min(1).max(5).default(2),
  categoria: z.string().optional().nullable(),
  ubicacion: z.string().optional().nullable(),
  estado: zEstadoJuego.default('DISPONIBLE'),
  notas: z.string().optional().nullable(),
  activo: z.boolean().default(true),
});

export default async function rutasJuegos(app: FastifyInstance) {
  app.get('/', { preHandler: requierePermiso('juegos.ver') }, async (req) => {
    const q = query(
      req,
      z.object({
        texto: z.string().optional(),
        estado: zEstadoJuego.optional(),
        jugadores: z.coerce.number().int().optional(),
        maxDuracion: z.coerce.number().int().optional(),
        categoria: z.string().optional(),
      }),
    );
    const juegos = await prisma.juego.findMany({
      where: {
        activo: true,
        estado: q.estado,
        categoria: q.categoria,
        duracionMin: q.maxDuracion ? { lte: q.maxDuracion } : undefined,
        nombre: q.texto ? { contains: q.texto } : undefined,
        // Un juego "para 5" debe admitir 5 en su rango de jugadores.
        ...(q.jugadores
          ? { minJugadores: { lte: q.jugadores }, maxJugadores: { gte: q.jugadores } }
          : {}),
      },
      orderBy: { nombre: 'asc' },
      include: {
        prestamos: {
          where: { estado: 'ACTIVO' },
          include: { mesa: { select: { id: true, nombre: true } } },
          take: 1,
        },
      },
    });
    return juegos.map((j) => ({
      ...j,
      prestamos: undefined,
      prestamoActivo: j.prestamos[0]
        ? {
            id: j.prestamos[0].id,
            mesa: j.prestamos[0].mesa,
            inicioEn: j.prestamos[0].inicioEn,
          }
        : null,
    }));
  });

  app.get('/categorias', { preHandler: requierePermiso('juegos.ver') }, async () => {
    const filas = await prisma.juego.findMany({
      where: { activo: true, categoria: { not: null } },
      select: { categoria: true },
      distinct: ['categoria'],
    });
    return filas.map((f) => f.categoria).filter(Boolean).sort();
  });

  app.post('/', { preHandler: requierePermiso('juegos.gestionar') }, async (req) => {
    const datos = body(req, zJuego);
    const existe = await prisma.juego.findUnique({ where: { nombre: datos.nombre } });
    if (existe) throw conflicto('Ya hay un juego con ese nombre');
    return prisma.juego.create({ data: datos });
  });

  app.patch('/:id', { preHandler: requierePermiso('juegos.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    return prisma.juego.update({ where: { id }, data: body(req, zJuego.partial()) });
  });

  app.delete('/:id', { preHandler: requierePermiso('juegos.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    await prisma.juego.update({ where: { id }, data: { activo: false } });
    return { ok: true };
  });

  // -- Prestamos ------------------------------------------------------------
  app.get('/prestamos', { preHandler: requierePermiso('juegos.ver') }, async (req) => {
    const q = query(req, z.object({ activos: z.coerce.boolean().default(true) }));
    const prestamos = await prisma.prestamoJuego.findMany({
      where: q.activos ? { estado: 'ACTIVO' } : {},
      orderBy: { inicioEn: 'desc' },
      take: 100,
      include: {
        juego: { select: { id: true, nombre: true } },
        mesa: { select: { id: true, nombre: true } },
        usuario: { select: { nombre: true } },
        pedido: { select: { id: true, numero: true } },
      },
    });
    return prestamos.map((p) => ({
      ...p,
      minutos: Math.floor(
        ((p.finEn ? new Date(p.finEn).getTime() : Date.now()) - new Date(p.inicioEn).getTime()) /
          60000,
      ),
    }));
  });

  /** Entrega un juego a una mesa y lo marca como prestado. */
  app.post('/:id/prestar', { preHandler: requierePermiso('juegos.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const { mesaId, pedidoId, notas } = body(
      req,
      z.object({
        mesaId: z.string().optional().nullable(),
        pedidoId: z.string().optional().nullable(),
        notas: z.string().optional().nullable(),
      }),
    );
    const juego = await prisma.juego.findUnique({ where: { id } });
    if (!juego) throw noEncontrado('Juego');
    if (juego.estado === 'PRESTADO') throw conflicto('Ese juego ya está en una mesa');
    if (juego.estado !== 'DISPONIBLE') throw conflicto(`El juego está en estado ${juego.estado}`);

    const prestamo = await prisma.$transaction(async (tx) => {
      await tx.juego.update({ where: { id }, data: { estado: 'PRESTADO' } });
      return tx.prestamoJuego.create({
        data: {
          juegoId: id,
          mesaId: mesaId || null,
          pedidoId: pedidoId || null,
          usuarioId: req.usuario!.id,
          notas: notas || null,
        },
        include: { juego: true, mesa: true },
      });
    });
    emitir('juegos', 'juego:actualizado', { id });
    emitir('sala', 'sala:recargar', {});
    return prestamo;
  });

  app.post('/prestamos/:id/devolver', { preHandler: requierePermiso('juegos.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const { estadoJuego, notas } = body(
      req,
      z.object({
        estadoJuego: zEstadoJuego.default('DISPONIBLE'),
        notas: z.string().optional().nullable(),
      }),
    );
    const prestamo = await prisma.prestamoJuego.findUnique({ where: { id } });
    if (!prestamo) throw noEncontrado('Préstamo');
    if (prestamo.estado === 'DEVUELTO') throw conflicto('Ese préstamo ya está cerrado');

    const cerrado = await prisma.$transaction(async (tx) => {
      await tx.juego.update({ where: { id: prestamo.juegoId }, data: { estado: estadoJuego } });
      return tx.prestamoJuego.update({
        where: { id },
        data: {
          estado: 'DEVUELTO',
          finEn: new Date(),
          notas: notas ?? prestamo.notas,
        },
        include: { juego: true },
      });
    });
    emitir('juegos', 'juego:actualizado', { id: prestamo.juegoId });
    emitir('sala', 'sala:recargar', {});
    return cerrado;
  });
}
