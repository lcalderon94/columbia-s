import type { Tx } from './db.js';

/**
 * Devuelve el siguiente numero de una secuencia de forma atomica.
 * Debe llamarse SIEMPRE dentro de una transaccion para que dos cajas
 * simultaneas no puedan sacar el mismo numero de pedido o de factura.
 */
export async function siguienteNumero(tx: Tx, clave: string): Promise<number> {
  const actual = await tx.contador.findUnique({ where: { clave } });
  if (!actual) {
    await tx.contador.create({ data: { clave, valor: 1 } });
    return 1;
  }
  const actualizado = await tx.contador.update({
    where: { clave },
    data: { valor: { increment: 1 } },
  });
  return actualizado.valor;
}
