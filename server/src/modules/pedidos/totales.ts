import { agruparDesglose, aplicarDescuento, type LineaDesglose } from '../../lib/dinero.js';

export interface LineaCalculable {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitCent: number;
  modificadorCent: number;
  ivaTipo: number;
  estado: string;
  invitada: boolean;
  descuentoTipo?: string | null;
  descuentoValor: number;
}

export interface LineaCalculada extends LineaCalculable {
  brutoCent: number;
  descuentoLineaCent: number;
  /** Parte del descuento del pedido que le toca a esta linea. */
  descuentoPedidoCent: number;
  totalCent: number;
}

export interface TotalesPedido {
  lineas: LineaCalculada[];
  /** Suma de lineas a precio de carta, antes de cualquier descuento. */
  brutoCent: number;
  descuentoLineasCent: number;
  descuentoPedidoCent: number;
  descuentoTotalCent: number;
  invitadoCent: number;
  /** Lo que paga el cliente, IVA incluido. */
  totalCent: number;
  baseCent: number;
  cuotaCent: number;
  desglose: LineaDesglose[];
}

/**
 * Calcula el total de un pedido y su desglose de IVA.
 *
 * Reglas:
 *  - Las lineas ANULADO no cuentan.
 *  - Las lineas invitadas se cobran a 0 pero se contabilizan aparte.
 *  - El descuento de pedido se reparte entre las lineas en proporcion a su
 *    importe, para que el desglose de IVA cuadre al centimo. El ultimo
 *    centimo de redondeo se ajusta en la linea de mayor importe.
 */
export function calcularTotales(
  lineas: LineaCalculable[],
  descuentoPedidoTipo?: string | null,
  descuentoPedidoValor = 0,
): TotalesPedido {
  const vivas = lineas.filter((l) => l.estado !== 'ANULADO');

  const calculadas: LineaCalculada[] = vivas.map((l) => {
    const brutoCent = (l.precioUnitCent + l.modificadorCent) * l.cantidad;
    const descuentoLineaCent = l.invitada
      ? brutoCent
      : aplicarDescuento(brutoCent, l.descuentoTipo, l.descuentoValor);
    return {
      ...l,
      brutoCent,
      descuentoLineaCent,
      descuentoPedidoCent: 0,
      totalCent: brutoCent - descuentoLineaCent,
    };
  });

  const brutoCent = calculadas.reduce((a, l) => a + l.brutoCent, 0);
  const invitadoCent = calculadas.filter((l) => l.invitada).reduce((a, l) => a + l.brutoCent, 0);
  const descuentoLineasCent = calculadas.reduce((a, l) => a + l.descuentoLineaCent, 0);
  const subtotalCent = calculadas.reduce((a, l) => a + l.totalCent, 0);

  const descuentoPedidoCent = aplicarDescuento(
    subtotalCent,
    descuentoPedidoTipo,
    descuentoPedidoValor,
  );

  if (descuentoPedidoCent > 0 && subtotalCent > 0) {
    let repartido = 0;
    const conImporte = calculadas.filter((l) => l.totalCent > 0);
    conImporte.forEach((l, i) => {
      const esUltima = i === conImporte.length - 1;
      const parte = esUltima
        ? descuentoPedidoCent - repartido
        : Math.round((descuentoPedidoCent * l.totalCent) / subtotalCent);
      l.descuentoPedidoCent = parte;
      l.totalCent -= parte;
      repartido += parte;
    });
  }

  const totalCent = calculadas.reduce((a, l) => a + l.totalCent, 0);
  const desglose = agruparDesglose(
    calculadas
      .filter((l) => l.totalCent > 0)
      .map((l) => ({ ivaTipo: l.ivaTipo, totalCent: l.totalCent })),
  );

  return {
    lineas: calculadas,
    brutoCent,
    descuentoLineasCent,
    descuentoPedidoCent,
    descuentoTotalCent: descuentoLineasCent + descuentoPedidoCent,
    invitadoCent,
    totalCent,
    baseCent: desglose.reduce((a, d) => a + d.baseCent, 0),
    cuotaCent: desglose.reduce((a, d) => a + d.cuotaCent, 0),
    desglose,
  };
}

/** Lo que falta por cobrar de un pedido, teniendo en cuenta pagos ya hechos. */
export function pendienteDeCobro(
  totalCent: number,
  pagos: { importeCent: number; estado: string }[],
): number {
  const cobrado = pagos
    .filter((p) => p.estado === 'COMPLETADO')
    .reduce((a, p) => a + p.importeCent, 0);
  return totalCent - cobrado;
}
