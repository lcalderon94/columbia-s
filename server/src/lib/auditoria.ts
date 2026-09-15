import { prisma, type Tx } from './db.js';

export interface EntradaAuditoria {
  usuarioId?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  detalle?: unknown;
}

/**
 * Deja constancia de las acciones sensibles (anulaciones, descuentos,
 * aperturas y cierres de caja, cambios de carta...). Nunca lanza: un fallo
 * al auditar no debe tumbar la operacion de negocio.
 */
export async function auditar(entrada: EntradaAuditoria, tx: Tx = prisma): Promise<void> {
  try {
    await tx.registroAuditoria.create({
      data: {
        usuarioId: entrada.usuarioId ?? null,
        accion: entrada.accion,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId ?? null,
        detalle: entrada.detalle === undefined ? null : JSON.stringify(entrada.detalle),
      },
    });
  } catch (e) {
    console.error('[auditoria] no se pudo registrar', entrada.accion, e);
  }
}
