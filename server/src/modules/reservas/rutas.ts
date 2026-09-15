import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../../lib/db.js';
import { body, params, query, zId } from '../../lib/http.js';
import { requierePermiso } from '../../lib/auth.js';
import { conflicto, invalido, noEncontrado } from '../../lib/errores.js';
import { auditar } from '../../lib/auditoria.js';
import { emitir } from '../../lib/realtime.js';
import { siguienteNumero } from '../../lib/contador.js';
import { zEstadoReserva, zOrigenReserva } from '../../types/dominio.js';

const zCrear = z.object({
  clienteNombre: z.string().min(2),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  fecha: z.coerce.date(),
  duracionMin: z.number().int().min(30).max(600).default(120),
  personas: z.number().int().min(1).max(60),
  mesaIds: z.array(z.string()).default([]),
  estado: zEstadoReserva.default('CONFIRMADA'),
  origen: zOrigenReserva.default('LOCAL'),
  notas: z.string().optional().nullable(),
  juegoSolicitadoId: z.string().optional().nullable(),
});

const zEditar = zCrear.partial();

const incluir = {
  mesas: { include: { mesa: { select: { id: true, nombre: true, capacidad: true, zonaId: true } } } },
  juegoSolicitado: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  pedido: { select: { id: true, numero: true, estado: true } },
};

function mapear(r: any) {
  return {
    id: r.id,
    codigo: r.codigo,
    clienteNombre: r.clienteNombre,
    telefono: r.telefono,
    email: r.email,
    fecha: r.fecha,
    fin: dayjs(r.fecha).add(r.duracionMin, 'minute').toDate(),
    duracionMin: r.duracionMin,
    personas: r.personas,
    estado: r.estado,
    origen: r.origen,
    notas: r.notas,
    juegoSolicitado: r.juegoSolicitado,
    mesas: r.mesas.map((m: any) => m.mesa),
    pedido: r.pedido,
    creadoPor: r.creadoPor,
    creadoEn: r.creadoEn,
  };
}

const ESTADOS_QUE_OCUPAN = ['PENDIENTE', 'CONFIRMADA', 'SENTADA'];

/**
 * Busca reservas que pisen el intervalo dado en alguna de las mesas.
 * Dos reservas solapan si inicioA < finB y inicioB < finA.
 */
async function solapes(
  mesaIds: string[],
  inicio: Date,
  duracionMin: number,
  excluirReservaId?: string,
) {
  if (mesaIds.length === 0) return [];
  const fin = dayjs(inicio).add(duracionMin, 'minute').toDate();
  // Ventana amplia: una reserva anterior puede seguir viva al empezar la nueva.
  const candidatas = await prisma.reserva.findMany({
    where: {
      estado: { in: ESTADOS_QUE_OCUPAN },
      id: excluirReservaId ? { not: excluirReservaId } : undefined,
      fecha: {
        gte: dayjs(inicio).subtract(12, 'hour').toDate(),
        lte: dayjs(fin).add(12, 'hour').toDate(),
      },
      mesas: { some: { mesaId: { in: mesaIds } } },
    },
    include: { mesas: { include: { mesa: { select: { id: true, nombre: true } } } } },
  });
  return candidatas.filter((r) => {
    const rInicio = r.fecha;
    const rFin = dayjs(r.fecha).add(r.duracionMin, 'minute').toDate();
    return rInicio < fin && inicio < rFin;
  });
}

export default async function rutasReservas(app: FastifyInstance) {
  /** Listado por dia (por defecto hoy) o por rango. */
  app.get('/', { preHandler: requierePermiso('reservas.ver') }, async (req) => {
    const q = query(
      req,
      z.object({
        desde: z.coerce.date().optional(),
        hasta: z.coerce.date().optional(),
        dia: z.coerce.date().optional(),
        estado: zEstadoReserva.optional(),
        texto: z.string().optional(),
      }),
    );
    let desde = q.desde;
    let hasta = q.hasta;
    if (q.dia) {
      desde = dayjs(q.dia).startOf('day').toDate();
      hasta = dayjs(q.dia).endOf('day').toDate();
    }
    if (!desde && !hasta && !q.texto) {
      desde = dayjs().startOf('day').toDate();
      hasta = dayjs().endOf('day').toDate();
    }
    const lista = await prisma.reserva.findMany({
      where: {
        fecha: desde || hasta ? { gte: desde, lte: hasta } : undefined,
        estado: q.estado,
        OR: q.texto
          ? [
              { clienteNombre: { contains: q.texto } },
              { telefono: { contains: q.texto } },
              { codigo: { contains: q.texto } },
            ]
          : undefined,
      },
      orderBy: { fecha: 'asc' },
      include: incluir,
    });
    return lista.map(mapear);
  });

  /** Mesas libres para un tramo horario: alimenta el selector al reservar. */
  app.get('/disponibilidad', { preHandler: requierePermiso('reservas.ver') }, async (req) => {
    const q = query(
      req,
      z.object({
        fecha: z.coerce.date(),
        duracionMin: z.coerce.number().int().default(120),
        personas: z.coerce.number().int().default(2),
        excluirReservaId: z.string().optional(),
      }),
    );
    const mesas = await prisma.mesa.findMany({
      where: { activa: true, estado: { not: 'FUERA_SERVICIO' } },
      include: { zona: { select: { id: true, nombre: true } } },
      orderBy: { nombre: 'asc' },
    });
    const ocupadas = await solapes(
      mesas.map((m) => m.id),
      q.fecha,
      q.duracionMin,
      q.excluirReservaId,
    );
    const ocupadasIds = new Set(ocupadas.flatMap((r) => r.mesas.map((m) => m.mesaId)));
    return {
      fecha: q.fecha,
      duracionMin: q.duracionMin,
      mesas: mesas.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        capacidad: m.capacidad,
        zona: m.zona,
        disponible: !ocupadasIds.has(m.id),
        suficiente: m.capacidad >= q.personas,
      })),
    };
  });

  app.get('/:id', { preHandler: requierePermiso('reservas.ver') }, async (req) => {
    const { id } = params(req, zId);
    const r = await prisma.reserva.findUnique({ where: { id }, include: incluir });
    if (!r) throw noEncontrado('Reserva');
    return mapear(r);
  });

  app.post('/', { preHandler: requierePermiso('reservas.gestionar') }, async (req) => {
    const datos = body(req, zCrear);
    const choques = await solapes(datos.mesaIds, datos.fecha, datos.duracionMin);
    if (choques.length) {
      const nombres = [...new Set(choques.flatMap((c) => c.mesas.map((m) => m.mesa.nombre)))];
      throw conflicto(`Esas mesas ya están reservadas a esa hora: ${nombres.join(', ')}`);
    }

    const creada = await prisma.$transaction(async (tx) => {
      const n = await siguienteNumero(tx, 'reserva');
      return tx.reserva.create({
        data: {
          codigo: `R-${String(n).padStart(5, '0')}`,
          clienteNombre: datos.clienteNombre,
          telefono: datos.telefono || null,
          email: datos.email || null,
          fecha: datos.fecha,
          duracionMin: datos.duracionMin,
          personas: datos.personas,
          estado: datos.estado,
          origen: datos.origen,
          notas: datos.notas || null,
          juegoSolicitadoId: datos.juegoSolicitadoId || null,
          creadoPorId: req.usuario!.id,
          mesas: { create: datos.mesaIds.map((mesaId) => ({ mesaId })) },
        },
        include: incluir,
      });
    });

    // Si la reserva es para dentro de poco, la mesa ya se marca como reservada.
    if (datos.mesaIds.length && dayjs(datos.fecha).diff(dayjs(), 'minute') < 90) {
      await prisma.mesa.updateMany({
        where: { id: { in: datos.mesaIds }, estado: 'LIBRE' },
        data: { estado: 'RESERVADA' },
      });
      emitir('sala', 'sala:recargar', {});
    }
    emitir('reservas', 'reserva:creada', mapear(creada));
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'RESERVA_CREADA',
      entidad: 'Reserva',
      entidadId: creada.id,
      detalle: { codigo: creada.codigo, personas: creada.personas },
    });
    return mapear(creada);
  });

  app.patch('/:id', { preHandler: requierePermiso('reservas.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(req, zEditar);
    const actual = await prisma.reserva.findUnique({ where: { id }, include: incluir });
    if (!actual) throw noEncontrado('Reserva');

    const mesaIds = datos.mesaIds ?? actual.mesas.map((m) => m.mesaId);
    const fecha = datos.fecha ?? actual.fecha;
    const duracion = datos.duracionMin ?? actual.duracionMin;
    const estadoFinal = datos.estado ?? actual.estado;

    if (ESTADOS_QUE_OCUPAN.includes(estadoFinal)) {
      const choques = await solapes(mesaIds, fecha, duracion, id);
      if (choques.length) {
        const nombres = [...new Set(choques.flatMap((c) => c.mesas.map((m) => m.mesa.nombre)))];
        throw conflicto(`Esas mesas ya están reservadas a esa hora: ${nombres.join(', ')}`);
      }
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      if (datos.mesaIds) {
        await tx.reservaMesa.deleteMany({ where: { reservaId: id } });
        if (datos.mesaIds.length) {
          await tx.reservaMesa.createMany({
            data: datos.mesaIds.map((mesaId) => ({ reservaId: id, mesaId })),
          });
        }
      }
      return tx.reserva.update({
        where: { id },
        data: {
          clienteNombre: datos.clienteNombre,
          telefono: datos.telefono === undefined ? undefined : datos.telefono || null,
          email: datos.email === undefined ? undefined : datos.email || null,
          fecha: datos.fecha,
          duracionMin: datos.duracionMin,
          personas: datos.personas,
          estado: datos.estado,
          origen: datos.origen,
          notas: datos.notas === undefined ? undefined : datos.notas || null,
          juegoSolicitadoId:
            datos.juegoSolicitadoId === undefined ? undefined : datos.juegoSolicitadoId || null,
        },
        include: incluir,
      });
    });

    emitir('reservas', 'reserva:actualizada', mapear(actualizada));
    return mapear(actualizada);
  });

  /**
   * Sentar la reserva: marca las mesas como ocupadas y, si se pide, abre
   * directamente el pedido con el numero de comensales de la reserva.
   */
  app.post('/:id/sentar', { preHandler: requierePermiso('reservas.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const { abrirPedido, mesaId } = body(
      req,
      z.object({ abrirPedido: z.boolean().default(true), mesaId: z.string().optional() }),
    );
    const reserva = await prisma.reserva.findUnique({ where: { id }, include: incluir });
    if (!reserva) throw noEncontrado('Reserva');
    if (reserva.estado === 'SENTADA') throw conflicto('La reserva ya está sentada');
    if (['CANCELADA', 'COMPLETADA', 'NO_SHOW'].includes(reserva.estado)) {
      throw invalido(`No se puede sentar una reserva en estado ${reserva.estado}`);
    }

    const mesaObjetivo = mesaId ?? reserva.mesas[0]?.mesaId;
    if (!mesaObjetivo) throw invalido('La reserva no tiene mesa asignada');

    const resultado = await prisma.$transaction(async (tx) => {
      let pedido = null;
      if (abrirPedido) {
        const yaAbierto = await tx.pedido.findFirst({
          where: { mesaId: mesaObjetivo, estado: { in: ['ABIERTO', 'PARA_COBRAR'] } },
        });
        if (yaAbierto) {
          pedido = yaAbierto;
        } else {
          const numero = await siguienteNumero(tx, 'pedido');
          pedido = await tx.pedido.create({
            data: {
              numero,
              tipo: 'MESA',
              mesaId: mesaObjetivo,
              comensales: reserva.personas,
              camareroId: req.usuario!.id,
              notas: reserva.notas,
            },
          });
        }
      }
      const idsMesas = reserva.mesas.map((m) => m.mesaId);
      await tx.mesa.updateMany({
        where: { id: { in: idsMesas.length ? idsMesas : [mesaObjetivo] } },
        data: { estado: 'OCUPADA' },
      });
      const actualizada = await tx.reserva.update({
        where: { id },
        data: { estado: 'SENTADA', pedidoId: pedido?.id ?? null },
        include: incluir,
      });
      return { reserva: actualizada, pedido };
    });

    emitir('sala', 'sala:recargar', {});
    emitir('reservas', 'reserva:actualizada', mapear(resultado.reserva));
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'RESERVA_SENTADA',
      entidad: 'Reserva',
      entidadId: id,
      detalle: { mesaId: mesaObjetivo, pedidoId: resultado.pedido?.id },
    });
    return { reserva: mapear(resultado.reserva), pedidoId: resultado.pedido?.id ?? null };
  });

  app.post('/:id/estado', { preHandler: requierePermiso('reservas.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const { estado, motivo } = body(
      req,
      z.object({ estado: zEstadoReserva, motivo: z.string().optional() }),
    );
    const reserva = await prisma.reserva.findUnique({ where: { id }, include: incluir });
    if (!reserva) throw noEncontrado('Reserva');

    const actualizada = await prisma.reserva.update({
      where: { id },
      data: { estado },
      include: incluir,
    });

    // Al cancelar o marcar no-show liberamos las mesas que solo esperaban esto.
    if (['CANCELADA', 'NO_SHOW', 'COMPLETADA'].includes(estado)) {
      const idsMesas = reserva.mesas.map((m) => m.mesaId);
      if (idsMesas.length) {
        await prisma.mesa.updateMany({
          where: { id: { in: idsMesas }, estado: 'RESERVADA' },
          data: { estado: 'LIBRE' },
        });
        emitir('sala', 'sala:recargar', {});
      }
    }
    await auditar({
      usuarioId: req.usuario!.id,
      accion: `RESERVA_${estado}`,
      entidad: 'Reserva',
      entidadId: id,
      detalle: { motivo },
    });
    emitir('reservas', 'reserva:actualizada', mapear(actualizada));
    return mapear(actualizada);
  });

  app.delete('/:id', { preHandler: requierePermiso('reservas.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    await prisma.reserva.update({ where: { id }, data: { estado: 'CANCELADA' } });
    emitir('reservas', 'reserva:actualizada', { id });
    return { ok: true };
  });
}
