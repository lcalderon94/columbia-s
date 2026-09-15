import type { FastifyRequest } from 'fastify';
import { z, type ZodTypeAny } from 'zod';
import { invalido } from './errores.js';

/** Valida el body con un esquema Zod y devuelve el dato tipado. */
export function body<T extends ZodTypeAny>(req: FastifyRequest, esquema: T): z.infer<T> {
  // Un DELETE sin cuerpo llega como undefined: lo tratamos como objeto vacio.
  const r = esquema.safeParse(req.body ?? {});
  if (!r.success) throw invalido('Datos no válidos', r.error.flatten());
  return r.data;
}

export function query<T extends ZodTypeAny>(req: FastifyRequest, esquema: T): z.infer<T> {
  const r = esquema.safeParse(req.query ?? {});
  if (!r.success) throw invalido('Parámetros no válidos', r.error.flatten());
  return r.data;
}

export function params<T extends ZodTypeAny>(req: FastifyRequest, esquema: T): z.infer<T> {
  const r = esquema.safeParse(req.params);
  if (!r.success) throw invalido('Ruta no válida', r.error.flatten());
  return r.data;
}

export const zId = z.object({ id: z.string().min(1) });
