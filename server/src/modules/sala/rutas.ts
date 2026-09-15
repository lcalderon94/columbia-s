import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { body, params, zId } from '../../lib/http.js';
import { requierePermiso } from '../../lib/auth.js';
import { conflicto, invalido, noEncontrado } from '../../lib/errores.js';
import { auditar } from '../../lib/auditoria.js';
import { emitir } from '../../lib/realtime.js';
import { zEstadoMesa, zFormaMesa } from '../../types/dominio.js';

const zZona = z.object({
  nombre: z.string().min(1),
  orden: z.number().int().default(0),
  color: z.string().default('#64748b'),
  activa: z.boolean().default(true),
});

const zMesa = z.object({
  zonaId: z.string().min(1),
  nombre: z.string().min(1),
  capacidad: z.number().int().min(1).max(30).default(4),
  forma: zFormaMesa.default('REDONDA'),
  posX: z.number().int().default(40),
  posY: z.number().int().default(40),
  ancho: z.number().int().min(40).max(400).default(96),
  alto: z.number().int().min(40).max(400).default(96),
  activa: z.boolean().default(true),
});

/** Resumen de la mesa tal y como lo pinta el plano de sala. */
function mapearMesa(m: any) {
  const pedido = m.pedidos?.[0] ?? null;
  const totalCent =
    pedido?.lineas?.reduce(
      (acc: number, l: any) =>
        l.estado === 'ANULADO' || l.invitada
          ? acc
          : acc + (l.precioUnitCent + l.modificadorCent) * l.cantidad,
      0,
    ) ?? 0;
  return {
    id: m.id,
    zonaId: m.zonaId,
    zona: m.zona ? { id: m.zona.id, nombre: m.zona.nombre, color: m.zona.color } : undefined,
    nombre: m.nombre,
    capacidad: m.capacidad,
    forma: m.forma,
    posX: m.posX,
    posY: m.posY,
    ancho: m.ancho,
    alto: m.alto,
    estado: m.estado,
    activa: m.activa,
    unidaAId: m.unidaAId,
    unidas: (m.unidas ?? []).map((u: any) => ({ id: u.id, nombre: u.nombre })),
    pedido: pedido
      ? {
          id: pedido.id,
          numero: pedido.numero,
          estado: pedido.estado,
          comensales: pedido.comensales,
          abiertoEn: pedido.abiertoEn,
          camarero: pedido.camarero?.nombre ?? null,
          totalCent,
          lineasPendientes:
            pedido.lineas?.filter((l: any) => l.estado === 'PENDIENTE').length ?? 0,
        }
      : null,
    reservaProxima: m.reservas?.[0]?.reserva
      ? {
          id: m.reservas[0].reserva.id,
          clienteNombre: m.reservas[0].reserva.clienteNombre,
          fecha: m.reservas[0].reserva.fecha,
          personas: m.reservas[0].reserva.personas,
        }
      : null,
    juegosEnMesa: (m.prestamos ?? []).map((p: any) => ({
      id: p.id,
      juego: p.juego?.nombre,
      inicioEn: p.inicioEn,
    })),
  };
}

/**
 * Orden natural: "M10" va detras de "M9", no entre "M1" y "M2".
 * SQLite ordena como texto, asi que el criterio se aplica aqui.
 */
function porNombreNatural(a: { nombre: string }, b: { nombre: string }): number {
  return a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' });
}

const incluirMesa = {
  zona: true,
  unidas: { select: { id: true, nombre: true } },
  pedidos: {
    where: { estado: { in: ['ABIERTO', 'PARA_COBRAR'] } },
    include: { lineas: true, camarero: { select: { nombre: true } } },
    take: 1,
  },
  prestamos: { where: { estado: 'ACTIVO' }, include: { juego: { select: { nombre: true } } } },
  reservas: {
    where: {
      reserva: {
        estado: { in: ['CONFIRMADA', 'PENDIENTE'] },
        fecha: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
    },
    include: { reserva: true },
    take: 1,
  },
};

export default async function rutasSala(app: FastifyInstance) {
  /** Plano completo: zonas + mesas con su estado actual. */
  app.get('/', { preHandler: requierePermiso('sala.ver') }, async () => {
    const zonas = await prisma.zona.findMany({
      where: { activa: true },
      orderBy: { orden: 'asc' },
    });
    const mesas = await prisma.mesa.findMany({ where: { activa: true }, include: incluirMesa });
    const mapeadas = mesas.map(mapearMesa).sort(porNombreNatural);
    return {
      zonas: zonas.map((z) => ({
        ...z,
        mesas: mapeadas.filter((m) => m.zonaId === z.id),
      })),
      resumen: {
        total: mapeadas.length,
        libres: mapeadas.filter((m) => m.estado === 'LIBRE').length,
        ocupadas: mapeadas.filter((m) => m.estado === 'OCUPADA').length,
        reservadas: mapeadas.filter((m) => m.estado === 'RESERVADA').length,
        comensales: mapeadas.reduce((a, m) => a + (m.pedido?.comensales ?? 0), 0),
      },
    };
  });

  app.get('/mesas/:id', { preHandler: requierePermiso('sala.ver') }, async (req) => {
    const { id } = params(req, zId);
    const m = await prisma.mesa.findUnique({ where: { id }, include: incluirMesa });
    if (!m) throw noEncontrado('Mesa');
    return mapearMesa(m);
  });

  // -- Zonas ----------------------------------------------------------------
  app.post('/zonas', { preHandler: requierePermiso('sala.editar') }, async (req) => {
    const datos = body(req, zZona);
    const existe = await prisma.zona.findUnique({ where: { nombre: datos.nombre } });
    if (existe) throw conflicto('Ya existe una zona con ese nombre');
    return prisma.zona.create({ data: datos });
  });

  app.patch('/zonas/:id', { preHandler: requierePermiso('sala.editar') }, async (req) => {
    const { id } = params(req, zId);
    return prisma.zona.update({ where: { id }, data: body(req, zZona.partial()) });
  });

  app.delete('/zonas/:id', { preHandler: requierePermiso('sala.editar') }, async (req) => {
    const { id } = params(req, zId);
    const mesas = await prisma.mesa.count({ where: { zonaId: id, activa: true } });
    if (mesas > 0) throw invalido('La zona todavía tiene mesas activas');
    await prisma.zona.update({ where: { id }, data: { activa: false } });
    return { ok: true };
  });

  // -- Mesas ----------------------------------------------------------------
  app.post('/mesas', { preHandler: requierePermiso('sala.editar') }, async (req) => {
    const datos = body(req, zMesa);
    const existe = await prisma.mesa.findFirst({
      where: { zonaId: datos.zonaId, nombre: datos.nombre },
    });
    if (existe) throw conflicto('Ya hay una mesa con ese nombre en la zona');
    const creada = await prisma.mesa.create({ data: datos, include: incluirMesa });
    emitir('sala', 'mesa:actualizada', mapearMesa(creada));
    return mapearMesa(creada);
  });

  app.patch('/mesas/:id', { preHandler: requierePermiso('sala.editar') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(req, zMesa.partial());
    const m = await prisma.mesa.update({ where: { id }, data: datos, include: incluirMesa });
    emitir('sala', 'mesa:actualizada', mapearMesa(m));
    return mapearMesa(m);
  });

  /** Guarda de golpe las posiciones al arrastrar mesas en el editor de plano. */
  app.patch('/mesas/posiciones', { preHandler: requierePermiso('sala.editar') }, async (req) => {
    const datos = body(
      req,
      z.object({
        mesas: z.array(
          z.object({ id: z.string(), posX: z.number().int(), posY: z.number().int() }),
        ),
      }),
    );
    await prisma.$transaction(
      datos.mesas.map((m) =>
        prisma.mesa.update({ where: { id: m.id }, data: { posX: m.posX, posY: m.posY } }),
      ),
    );
    emitir('sala', 'sala:recargar', {});
    return { ok: true, actualizadas: datos.mesas.length };
  });

  /** Cambio manual de estado (p.ej. marcar LIMPIEZA o FUERA_SERVICIO). */
  app.post('/mesas/:id/estado', { preHandler: requierePermiso('sala.ver') }, async (req) => {
    const { id } = params(req, zId);
    const { estado } = body(req, z.object({ estado: zEstadoMesa }));
    const mesa = await prisma.mesa.findUnique({
      where: { id },
      include: { pedidos: { where: { estado: { in: ['ABIERTO', 'PARA_COBRAR'] } } } },
    });
    if (!mesa) throw noEncontrado('Mesa');
    if (mesa.pedidos.length > 0 && estado !== 'OCUPADA') {
      throw conflicto('La mesa tiene un pedido abierto: ciérralo o cóbralo primero');
    }
    const actualizada = await prisma.mesa.update({
      where: { id },
      data: { estado },
      include: incluirMesa,
    });
    emitir('sala', 'mesa:actualizada', mapearMesa(actualizada));
    return mapearMesa(actualizada);
  });

  /** Une varias mesas bajo una principal (grupos grandes de juego). */
  app.post('/mesas/:id/unir', { preHandler: requierePermiso('sala.ver') }, async (req) => {
    const { id } = params(req, zId);
    const { mesaIds } = body(req, z.object({ mesaIds: z.array(z.string()).min(1) }));
    if (mesaIds.includes(id)) throw invalido('Una mesa no puede unirse a sí misma');

    const principal = await prisma.mesa.findUnique({ where: { id } });
    if (!principal) throw noEncontrado('Mesa principal');

    const secundarias = await prisma.mesa.findMany({
      where: { id: { in: mesaIds } },
      include: { pedidos: { where: { estado: { in: ['ABIERTO', 'PARA_COBRAR'] } } } },
    });
    const conPedido = secundarias.filter((m) => m.pedidos.length > 0);
    if (conPedido.length) {
      throw conflicto(
        `No se pueden unir mesas con pedido abierto: ${conPedido.map((m) => m.nombre).join(', ')}`,
      );
    }
    await prisma.mesa.updateMany({
      where: { id: { in: mesaIds } },
      data: { unidaAId: id, estado: principal.estado },
    });
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'MESAS_UNIDAS',
      entidad: 'Mesa',
      entidadId: id,
      detalle: { mesaIds },
    });
    emitir('sala', 'sala:recargar', {});
    return { ok: true };
  });

  app.post('/mesas/:id/separar', { preHandler: requierePermiso('sala.ver') }, async (req) => {
    const { id } = params(req, zId);
    await prisma.mesa.updateMany({ where: { unidaAId: id }, data: { unidaAId: null } });
    emitir('sala', 'sala:recargar', {});
    return { ok: true };
  });

  app.delete('/mesas/:id', { preHandler: requierePermiso('sala.editar') }, async (req) => {
    const { id } = params(req, zId);
    const abiertos = await prisma.pedido.count({
      where: { mesaId: id, estado: { in: ['ABIERTO', 'PARA_COBRAR'] } },
    });
    if (abiertos > 0) throw conflicto('La mesa tiene un pedido abierto');
    await prisma.mesa.update({ where: { id }, data: { activa: false, unidaAId: null } });
    emitir('sala', 'sala:recargar', {});
    return { ok: true };
  });
}
