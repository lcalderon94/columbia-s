/**
 * Todo el dinero del sistema viaja en centimos enteros. Estas utilidades son
 * el unico sitio donde se redondea, para que base + cuota == total siempre.
 */

export const euros = (cent: number): number => Math.round(cent) / 100;

export function formatearEuros(cent: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(euros(cent));
}

/** Reparte un descuento sobre un importe. */
export function aplicarDescuento(
  importeCent: number,
  tipo: string | null | undefined,
  valor: number,
): number {
  if (!tipo || !valor) return 0;
  if (tipo === 'PORCENTAJE') {
    const pct = Math.min(Math.max(valor, 0), 100);
    return Math.round((importeCent * pct) / 100);
  }
  return Math.min(Math.max(Math.round(valor), 0), importeCent);
}

/**
 * Desglosa un importe CON IVA incluido en base imponible y cuota.
 * En hosteleria los precios de carta ya llevan el IVA dentro.
 */
export function desglosarIva(totalConIvaCent: number, ivaTipo: number): {
  baseCent: number;
  cuotaCent: number;
} {
  if (ivaTipo <= 0) return { baseCent: totalConIvaCent, cuotaCent: 0 };
  const baseCent = Math.round((totalConIvaCent * 100) / (100 + ivaTipo));
  return { baseCent, cuotaCent: totalConIvaCent - baseCent };
}

export interface LineaDesglose {
  ivaTipo: number;
  baseCent: number;
  cuotaCent: number;
  totalCent: number;
}

/** Agrupa importes por tipo de IVA y devuelve el desglose ordenado. */
export function agruparDesglose(
  partidas: { ivaTipo: number; totalCent: number }[],
): LineaDesglose[] {
  const mapa = new Map<number, number>();
  for (const p of partidas) {
    mapa.set(p.ivaTipo, (mapa.get(p.ivaTipo) ?? 0) + p.totalCent);
  }
  return [...mapa.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ivaTipo, totalCent]) => {
      const { baseCent, cuotaCent } = desglosarIva(totalCent, ivaTipo);
      return { ivaTipo, baseCent, cuotaCent, totalCent };
    });
}

/**
 * Reparte un importe entre N partes sin perder centimos:
 * los centimos sobrantes se suman a las primeras partes.
 */
export function repartir(totalCent: number, partes: number): number[] {
  if (partes <= 0) return [];
  const base = Math.floor(totalCent / partes);
  const resto = totalCent - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0));
}
