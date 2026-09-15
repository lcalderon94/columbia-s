import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prohibido, noAutorizado } from './errores.js';
import { tienePermiso, type Permiso, type Rol, type UsuarioToken } from '../types/dominio.js';

export const hashear = (texto: string) => bcrypt.hash(texto, 10);
export const comparar = (texto: string, hash: string) => bcrypt.compare(texto, hash);
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioToken;
  }
}

/** Exige sesion valida. Se usa como `preHandler`. */
export async function requiereSesion(req: FastifyRequest, _rep: FastifyReply): Promise<void> {
  try {
    const payload = await req.jwtVerify<UsuarioToken & { iat: number; exp: number }>();
    req.usuario = { id: payload.id, nombre: payload.nombre, rol: payload.rol };
  } catch {
    throw noAutorizado('Sesión no válida o caducada');
  }
}

/** Exige sesion valida + un permiso concreto. */
export function requierePermiso(permiso: Permiso) {
  return async function (req: FastifyRequest, rep: FastifyReply): Promise<void> {
    await requiereSesion(req, rep);
    if (!tienePermiso(req.usuario!.rol as Rol, permiso)) {
      throw prohibido(`Tu rol (${req.usuario!.rol}) no puede: ${permiso}`);
    }
  };
}

export function exigirPermiso(req: FastifyRequest, permiso: Permiso): void {
  if (!req.usuario || !tienePermiso(req.usuario.rol as Rol, permiso)) {
    throw prohibido(`Se requiere el permiso ${permiso}`);
  }
}
