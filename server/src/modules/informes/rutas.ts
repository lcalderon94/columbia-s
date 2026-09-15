import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../../lib/db.js';
import { body, query } from '../../lib/http.js';
import { requierePermiso } from '../../lib/auth.js';
import { calcularTotales } from '../pedidos/totales.js';

const zRango = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

function rango(q: { desde?: Date; hasta?: Date }) {
  return {
    desde: q.desde ?? dayjs().startOf('day').toDate(),
    hasta: q.hasta ?? dayjs().endOf('day').toDate(),
  };
}

export default async function rutasInformes(app: FastifyInstance) {
  /** Panel de inicio: como va el dia ahora mismo. */
  app.get('/hoy', { preHandler: requierePermiso('pedidos.ver') }, async () => {
    const desde = dayjs().startOf('day').toDate();
    const hasta = dayjs().endOf('day').toDate();

    const [pagos, pedidosAbiertos, pedidosCobrados, reservasHoy, ticketsPendientes, juegosFuera] =
      await Promise.all([
        prisma.pago.findMany({
          where: { estado: 'COMPLETADO', esPractica: false, creadoEn: { gte: desde, lte: hasta } },
        }),
        prisma.pedido.count({
          where: { estado: { in: ['ABIERTO', 'PARA_COBRAR'] }, esPractica: false },
        }),
        prisma.pedido.count({
          where: { estado: 'COBRADO', esPractica: false, cerradoEn: { gte: desde, lte: hasta } },
        }),
        prisma.reserva.count({
          where: { fecha: { gte: desde, lte: hasta }, estado: { in: ['CONFIRMADA', 'PENDIENTE'] } },
        }),
        prisma.ticketCocina.count({ where: { estado: { in: ['NUEVO', 'EN_PREPARACION'] } } }),
        prisma.prestamoJuego.count({ where: { estado: 'ACTIVO' } }),
      ]);

    const ventaCent = pagos.reduce((a, p) => a + p.importeCent, 0);
    const mesas = await prisma.mesa.findMany({ where: { activa: true }, select: { estado: true } });

    return {
      ventaCent,
      propinaCent: pagos.reduce((a, p) => a + p.propinaCent, 0),
      pedidosCobrados,
      ticketMedioCent: pedidosCobrados ? Math.round(ventaCent / pedidosCobrados) : 0,
      pedidosAbiertos,
      reservasHoy,
      ticketsPendientes,
      juegosFuera,
      mesas: {
        total: mesas.length,
        libres: mesas.filter((m) => m.estado === 'LIBRE').length,
        ocupadas: mesas.filter((m) => m.estado === 'OCUPADA').length,
      },
      porMetodo: ['EFECTIVO', 'TARJETA', 'BIZUM', 'VALE'].map((metodo) => ({
        metodo,
        importeCent: pagos.filter((p) => p.metodo === metodo).reduce((a, p) => a + p.importeCent, 0),
      })),
    };
  });

  /** Ventas por dia del periodo, para la grafica. */
  app.get('/ventas', { preHandler: requierePermiso('informes.ver') }, async (req) => {
    const q = rango(query(req, zRango));
    const pagos = await prisma.pago.findMany({
      where: { estado: 'COMPLETADO', esPractica: false, creadoEn: { gte: q.desde, lte: q.hasta } },
      select: { importeCent: true, propinaCent: true, metodo: true, creadoEn: true, pedidoId: true },
    });

    const porDia = new Map<string, { ventaCent: number; pedidos: Set<string> }>();
    for (const p of pagos) {
      const dia = dayjs(p.creadoEn).format('YYYY-MM-DD');
      const acc = porDia.get(dia) ?? { ventaCent: 0, pedidos: new Set<string>() };
      acc.ventaCent += p.importeCent;
      acc.pedidos.add(p.pedidoId);
      porDia.set(dia, acc);
    }

    // Franja horaria: ayuda a decidir turnos y refuerzos de cocina.
    const porHora = Array.from({ length: 24 }, (_, h) => ({
      hora: h,
      ventaCent: pagos
        .filter((p) => dayjs(p.creadoEn).hour() === h)
        .reduce((a, p) => a + p.importeCent, 0),
    }));

    return {
      ...q,
      totalCent: pagos.reduce((a, p) => a + p.importeCent, 0),
      propinaCent: pagos.reduce((a, p) => a + p.propinaCent, 0),
      porDia: [...porDia.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dia, v]) => ({
          dia,
          ventaCent: v.ventaCent,
          pedidos: v.pedidos.size,
          ticketMedioCent: v.pedidos.size ? Math.round(v.ventaCent / v.pedidos.size) : 0,
        })),
      porMetodo: ['EFECTIVO', 'TARJETA', 'BIZUM', 'VALE', 'INVITACION'].map((metodo) => ({
        metodo,
        importeCent: pagos.filter((p) => p.metodo === metodo).reduce((a, p) => a + p.importeCent, 0),
        num: pagos.filter((p) => p.metodo === metodo).length,
      })),
      porHora,
    };
  });

  /** Ranking de productos vendidos. */
  app.get('/productos', { preHandler: requierePermiso('informes.ver') }, async (req) => {
    const q = rango(query(req, zRango));
    const lineas = await prisma.lineaPedido.findMany({
      where: {
        estado: { not: 'ANULADO' },
        pedido: { estado: 'COBRADO', esPractica: false, cerradoEn: { gte: q.desde, lte: q.hasta } },
      },
      include: { producto: { select: { categoria: { select: { nombre: true } } } } },
    });

    const mapa = new Map<
      string,
      { nombre: string; categoria: string; unidades: number; importeCent: number }
    >();
    for (const l of lineas) {
      const clave = l.nombre;
      const acc = mapa.get(clave) ?? {
        nombre: l.nombre,
        categoria: l.producto?.categoria.nombre ?? 'Otros',
        unidades: 0,
        importeCent: 0,
      };
      acc.unidades += l.cantidad;
      acc.importeCent += l.invitada ? 0 : (l.precioUnitCent + l.modificadorCent) * l.cantidad;
      mapa.set(clave, acc);
    }

    const productos = [...mapa.values()].sort((a, b) => b.importeCent - a.importeCent);
    const porCategoria = new Map<string, { unidades: number; importeCent: number }>();
    for (const p of productos) {
      const acc = porCategoria.get(p.categoria) ?? { unidades: 0, importeCent: 0 };
      acc.unidades += p.unidades;
      acc.importeCent += p.importeCent;
      porCategoria.set(p.categoria, acc);
    }

    return {
      ...q,
      productos,
      porCategoria: [...porCategoria.entries()]
        .map(([categoria, v]) => ({ categoria, ...v }))
        .sort((a, b) => b.importeCent - a.importeCent),
    };
  });

  /** Rendimiento por camarero. */
  app.get('/camareros', { preHandler: requierePermiso('informes.ver') }, async (req) => {
    const q = rango(query(req, zRango));
    const pedidos = await prisma.pedido.findMany({
      where: { estado: 'COBRADO', esPractica: false, cerradoEn: { gte: q.desde, lte: q.hasta } },
      include: { camarero: { select: { id: true, nombre: true } }, lineas: true },
    });

    const mapa = new Map<
      string,
      { nombre: string; pedidos: number; ventaCent: number; comensales: number }
    >();
    for (const p of pedidos) {
      const clave = p.camarero?.id ?? 'sin-asignar';
      const acc = mapa.get(clave) ?? {
        nombre: p.camarero?.nombre ?? 'Sin asignar',
        pedidos: 0,
        ventaCent: 0,
        comensales: 0,
      };
      const t = calcularTotales(
        p.lineas.map((l) => ({
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
        p.descuentoTipo,
        p.descuentoValor,
      );
      acc.pedidos += 1;
      acc.ventaCent += t.totalCent;
      acc.comensales += p.comensales;
      mapa.set(clave, acc);
    }

    return {
      ...q,
      camareros: [...mapa.values()]
        .map((c) => ({
          ...c,
          ticketMedioCent: c.pedidos ? Math.round(c.ventaCent / c.pedidos) : 0,
          gastoPorComensalCent: c.comensales ? Math.round(c.ventaCent / c.comensales) : 0,
        }))
        .sort((a, b) => b.ventaCent - a.ventaCent),
    };
  });

  /** Uso de la biblioteca de juegos y peso del cover fee. */
  app.get('/juegos', { preHandler: requierePermiso('informes.ver') }, async (req) => {
    const q = rango(query(req, zRango));
    const prestamos = await prisma.prestamoJuego.findMany({
      where: { inicioEn: { gte: q.desde, lte: q.hasta } },
      include: { juego: { select: { id: true, nombre: true, categoria: true } } },
    });

    const mapa = new Map<string, { nombre: string; categoria: string | null; veces: number; minutos: number }>();
    for (const p of prestamos) {
      const acc = mapa.get(p.juegoId) ?? {
        nombre: p.juego.nombre,
        categoria: p.juego.categoria,
        veces: 0,
        minutos: 0,
      };
      acc.veces += 1;
      acc.minutos += Math.floor(
        ((p.finEn ? new Date(p.finEn).getTime() : Date.now()) - new Date(p.inicioEn).getTime()) /
          60000,
      );
      mapa.set(p.juegoId, acc);
    }

    const lineasCover = await prisma.lineaPedido.findMany({
      where: {
        estado: { not: 'ANULADO' },
        producto: { tipo: 'COVER' },
        pedido: { estado: 'COBRADO', esPractica: false, cerradoEn: { gte: q.desde, lte: q.hasta } },
      },
      include: { producto: { select: { nombre: true, codigoRapido: true } } },
    });

    const cover = new Map<string, { nombre: string; personas: number; importeCent: number }>();
    for (const l of lineasCover) {
      const clave = l.producto?.codigoRapido ?? l.nombre;
      const acc = cover.get(clave) ?? { nombre: l.nombre, personas: 0, importeCent: 0 };
      acc.personas += l.cantidad;
      acc.importeCent += l.precioUnitCent * l.cantidad;
      cover.set(clave, acc);
    }

    return {
      ...q,
      totalPrestamos: prestamos.length,
      juegos: [...mapa.values()]
        .map((j) => ({ ...j, mediaMin: j.veces ? Math.round(j.minutos / j.veces) : 0 }))
        .sort((a, b) => b.veces - a.veces),
      cover: [...cover.values()],
      coverTotalCent: [...cover.values()].reduce((a, c) => a + c.importeCent, 0),
    };
  });

  /** Ocupacion de sala y de reservas. */
  app.get('/ocupacion', { preHandler: requierePermiso('informes.ver') }, async (req) => {
    const q = rango(query(req, zRango));
    const reservas = await prisma.reserva.findMany({
      where: { fecha: { gte: q.desde, lte: q.hasta } },
      select: { estado: true, personas: true, origen: true },
    });
    const pedidos = await prisma.pedido.findMany({
      where: { abiertoEn: { gte: q.desde, lte: q.hasta }, estado: 'COBRADO', esPractica: false },
      select: { comensales: true, abiertoEn: true, cerradoEn: true, mesaId: true },
    });
    const duraciones = pedidos
      .filter((p) => p.cerradoEn)
      .map((p) => (new Date(p.cerradoEn!).getTime() - new Date(p.abiertoEn).getTime()) / 60000);

    return {
      ...q,
      reservas: {
        total: reservas.length,
        personas: reservas.reduce((a, r) => a + r.personas, 0),
        porEstado: ['CONFIRMADA', 'SENTADA', 'COMPLETADA', 'NO_SHOW', 'CANCELADA'].map((estado) => ({
          estado,
          num: reservas.filter((r) => r.estado === estado).length,
        })),
        porOrigen: ['LOCAL', 'TELEFONO', 'WEB'].map((origen) => ({
          origen,
          num: reservas.filter((r) => r.origen === origen).length,
        })),
      },
      servicios: {
        pedidos: pedidos.length,
        comensales: pedidos.reduce((a, p) => a + p.comensales, 0),
        duracionMediaMin: duraciones.length
          ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
          : 0,
      },
    };
  });

  // -- Ajustes del local ----------------------------------------------------
  app.get('/ajustes', { preHandler: requierePermiso('pedidos.ver') }, async () => {
    const filas = await prisma.ajuste.findMany();
    return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  });

  app.put('/ajustes', { preHandler: requierePermiso('ajustes.editar') }, async (req) => {
    const datos = body(req, z.record(z.string(), z.string()));
    await prisma.$transaction(
      Object.entries(datos).map(([clave, valor]) =>
        prisma.ajuste.upsert({ where: { clave }, create: { clave, valor }, update: { valor } }),
      ),
    );
    return { ok: true, guardados: Object.keys(datos).length };
  });
}
