import { describe, expect, it } from 'vitest';
import { calcularTotales, pendienteDeCobro } from '../src/modules/pedidos/totales.js';

const linea = (over: Partial<Parameters<typeof calcularTotales>[0][number]> = {}) => ({
  id: Math.random().toString(36).slice(2),
  nombre: 'Producto',
  cantidad: 1,
  precioUnitCent: 1000,
  modificadorCent: 0,
  ivaTipo: 10,
  estado: 'SERVIDO',
  invitada: false,
  descuentoTipo: null,
  descuentoValor: 0,
  ...over,
});

describe('totales del pedido', () => {
  it('suma líneas con cantidad y modificadores', () => {
    const t = calcularTotales([
      linea({ precioUnitCent: 1250, cantidad: 2, modificadorCent: 150 }),
      linea({ precioUnitCent: 230 }),
    ]);
    expect(t.brutoCent).toBe(1400 * 2 + 230);
    expect(t.totalCent).toBe(3030);
  });

  it('ignora las líneas anuladas', () => {
    const t = calcularTotales([linea(), linea({ estado: 'ANULADO' })]);
    expect(t.totalCent).toBe(1000);
    expect(t.lineas).toHaveLength(1);
  });

  it('una línea invitada no se cobra pero se contabiliza', () => {
    const t = calcularTotales([linea(), linea({ invitada: true })]);
    expect(t.totalCent).toBe(1000);
    expect(t.invitadoCent).toBe(1000);
  });

  it('aplica descuento de línea', () => {
    const t = calcularTotales([linea({ descuentoTipo: 'PORCENTAJE', descuentoValor: 50 })]);
    expect(t.totalCent).toBe(500);
    expect(t.descuentoLineasCent).toBe(500);
  });

  it('reparte el descuento de pedido entre las líneas sin perder céntimos', () => {
    const t = calcularTotales(
      [
        linea({ precioUnitCent: 1250 }),
        linea({ precioUnitCent: 890 }),
        linea({ precioUnitCent: 230 }),
      ],
      'PORCENTAJE',
      10,
    );
    const suma = t.lineas.reduce((a, l) => a + l.totalCent, 0);
    expect(suma).toBe(t.totalCent);
    expect(t.descuentoPedidoCent).toBe(237);
    expect(t.totalCent).toBe(2370 - 237);
    // Todo el descuento acaba repartido, sin sobras ni faltas
    expect(t.lineas.reduce((a, l) => a + l.descuentoPedidoCent, 0)).toBe(t.descuentoPedidoCent);
  });

  it('el desglose de IVA cuadra con el total', () => {
    const t = calcularTotales([
      linea({ precioUnitCent: 1250, ivaTipo: 10 }),
      linea({ precioUnitCent: 950, ivaTipo: 21 }),
    ]);
    expect(t.baseCent + t.cuotaCent).toBe(t.totalCent);
    expect(t.desglose.map((d) => d.ivaTipo)).toEqual([10, 21]);
  });

  it('el desglose sigue cuadrando con descuento de pedido', () => {
    const t = calcularTotales(
      [
        linea({ precioUnitCent: 1250, ivaTipo: 10 }),
        linea({ precioUnitCent: 950, ivaTipo: 21 }),
        linea({ precioUnitCent: 620, ivaTipo: 10 }),
      ],
      'IMPORTE',
      500,
    );
    expect(t.baseCent + t.cuotaCent).toBe(t.totalCent);
    expect(t.totalCent).toBe(2820 - 500);
  });

  it('calcula lo que falta por cobrar', () => {
    expect(
      pendienteDeCobro(3000, [
        { importeCent: 1000, estado: 'COMPLETADO' },
        { importeCent: 500, estado: 'ANULADO' },
      ]),
    ).toBe(2000);
  });
});
