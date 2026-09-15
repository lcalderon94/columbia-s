import { describe, expect, it } from 'vitest';
import {
  agruparDesglose,
  aplicarDescuento,
  desglosarIva,
  repartir,
  formatearEuros,
} from '../src/lib/dinero.js';

describe('desglose de IVA', () => {
  it('separa base y cuota de un precio que ya lleva el IVA dentro', () => {
    // Una hamburguesa de 12,50 € al 10%: base 11,36 + cuota 1,14
    const { baseCent, cuotaCent } = desglosarIva(1250, 10);
    expect(baseCent).toBe(1136);
    expect(cuotaCent).toBe(114);
    expect(baseCent + cuotaCent).toBe(1250);
  });

  it('nunca pierde ni gana céntimos al redondear', () => {
    for (let total = 1; total <= 3000; total++) {
      for (const iva of [4, 10, 21]) {
        const { baseCent, cuotaCent } = desglosarIva(total, iva);
        expect(baseCent + cuotaCent).toBe(total);
      }
    }
  });

  it('con IVA 0 no genera cuota', () => {
    expect(desglosarIva(500, 0)).toEqual({ baseCent: 500, cuotaCent: 0 });
  });

  it('agrupa varias partidas por tipo de IVA', () => {
    const desglose = agruparDesglose([
      { ivaTipo: 10, totalCent: 1250 },
      { ivaTipo: 10, totalCent: 750 },
      { ivaTipo: 21, totalCent: 1000 },
    ]);
    expect(desglose).toHaveLength(2);
    expect(desglose[0].ivaTipo).toBe(10);
    expect(desglose[0].totalCent).toBe(2000);
    expect(desglose[1].ivaTipo).toBe(21);
  });
});

describe('descuentos', () => {
  it('aplica un porcentaje', () => {
    expect(aplicarDescuento(1000, 'PORCENTAJE', 10)).toBe(100);
  });

  it('aplica un importe fijo', () => {
    expect(aplicarDescuento(1000, 'IMPORTE', 250)).toBe(250);
  });

  it('nunca descuenta más que el importe', () => {
    expect(aplicarDescuento(1000, 'IMPORTE', 5000)).toBe(1000);
    expect(aplicarDescuento(1000, 'PORCENTAJE', 300)).toBe(1000);
  });

  it('sin tipo no descuenta nada', () => {
    expect(aplicarDescuento(1000, null, 50)).toBe(0);
  });
});

describe('reparto de la cuenta', () => {
  it('reparte sin perder céntimos', () => {
    const partes = repartir(1000, 3);
    expect(partes).toEqual([334, 333, 333]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('reparte exacto cuando divide', () => {
    expect(repartir(1200, 4)).toEqual([300, 300, 300, 300]);
  });
});

describe('formato', () => {
  it('escribe euros en formato español', () => {
    expect(formatearEuros(1250).replace(/ /g, ' ')).toBe('12,50 €');
  });
});
