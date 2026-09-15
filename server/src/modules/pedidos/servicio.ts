import { prisma, type Tx } from '../../lib/db.js';
import { calcularTotales, pendienteDeCobro } from './totales.js';

export const incluirPedido = {
  lineas: { orderBy: { creadoEn: 'asc' as const } },
  mesa: { include: { zona: { select: { id: true, nombre: true } } } },
  camarero: { select: { id: true, nombre: true, color: true } },
  pagos: { where: { estado: 'COMPLETADO' } },
  tickets: { orderBy: { creadoEn: 'asc' as const } },
  prestamos: { where: { estado: 'ACTIVO' }, include: { juego: { select: { id: true, nombre: true } } } },
  facturas: { select: { id: true, codigo: true, tipo: true, estado: true, totalCent: true } },
};

/** Vista completa del pedido con totales ya calculados, tal cual la usa el TPV. */
export function mapearPedido(p: any) {
  const totales = calcularTotales(
    p.lineas.map((l: any) => ({
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
  const porId = new Map(totales.lineas.map((l) => [l.id, l]));

  return {
    id: p.id,
    numero: p.numero,
    tipo: p.tipo,
    estado: p.estado,
    comensales: p.comensales,
    notas: p.notas,
    abiertoEn: p.abiertoEn,
    cerradoEn: p.cerradoEn,
    descuentoTipo: p.descuentoTipo,
    descuentoValor: p.descuentoValor,
    descuentoMotivo: p.descuentoMotivo,
    mesa: p.mesa
      ? { id: p.mesa.id, nombre: p.mesa.nombre, zona: p.mesa.zona, capacidad: p.mesa.capacidad }
      : null,
    camarero: p.camarero ?? null,
    lineas: p.lineas.map((l: any) => {
      const c = porId.get(l.id);
      return {
        id: l.id,
        productoId: l.productoId,
        nombre: l.nombre,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioUnitCent: l.precioUnitCent,
        modificadorCent: l.modificadorCent,
        modificadores: l.modificadoresJson ? JSON.parse(l.modificadoresJson) : [],
        ivaTipo: l.ivaTipo,
        notas: l.notas,
        estado: l.estado,
        destino: l.destino,
        curso: l.curso,
        invitada: l.invitada,
        descuentoTipo: l.descuentoTipo,
        descuentoValor: l.descuentoValor,
        anuladaMotivo: l.anuladaMotivo,
        ticketId: l.ticketId,
        creadoEn: l.creadoEn,
        enviadoEn: l.enviadoEn,
        brutoCent: c?.brutoCent ?? 0,
        totalCent: c?.totalCent ?? 0,
      };
    }),
    tickets: (p.tickets ?? []).map((t: any) => ({
      id: t.id,
      destino: t.destino,
      numeroRonda: t.numeroRonda,
      estado: t.estado,
      creadoEn: t.creadoEn,
    })),
    pagos: (p.pagos ?? []).map((g: any) => ({
      id: g.id,
      metodo: g.metodo,
      importeCent: g.importeCent,
      propinaCent: g.propinaCent,
      creadoEn: g.creadoEn,
      ultimos4: g.ultimos4,
      refAutorizacion: g.refAutorizacion,
    })),
    facturas: p.facturas ?? [],
    juegos: (p.prestamos ?? []).map((pr: any) => ({
      prestamoId: pr.id,
      id: pr.juego.id,
      nombre: pr.juego.nombre,
      inicioEn: pr.inicioEn,
    })),
    totales: {
      brutoCent: totales.brutoCent,
      descuentoLineasCent: totales.descuentoLineasCent,
      descuentoPedidoCent: totales.descuentoPedidoCent,
      descuentoTotalCent: totales.descuentoTotalCent,
      invitadoCent: totales.invitadoCent,
      totalCent: totales.totalCent,
      baseCent: totales.baseCent,
      cuotaCent: totales.cuotaCent,
      desglose: totales.desglose,
      cobradoCent: totales.totalCent - pendienteDeCobro(totales.totalCent, p.pagos ?? []),
      pendienteCent: pendienteDeCobro(totales.totalCent, p.pagos ?? []),
      propinaCent: (p.pagos ?? []).reduce((a: number, g: any) => a + (g.propinaCent ?? 0), 0),
    },
  };
}

export async function cargarPedido(id: string, tx: Tx = prisma) {
  return tx.pedido.findUnique({ where: { id }, include: incluirPedido });
}

/** Caja abierta actual, o null. Los cobros se cuelgan de ella. */
export async function sesionCajaAbierta(tx: Tx = prisma) {
  return tx.sesionCaja.findFirst({ where: { estado: 'ABIERTA' }, orderBy: { abiertaEn: 'desc' } });
}
