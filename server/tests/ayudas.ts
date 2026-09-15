import type { FastifyInstance } from 'fastify';
import { construirApp } from '../src/app.js';

export interface Sesion {
  app: FastifyInstance;
  token: string;
}

export async function arrancarApp(): Promise<FastifyInstance> {
  const app = await construirApp();
  await app.ready();
  return app;
}

export async function entrar(app: FastifyInstance, pin: string): Promise<string> {
  const r = await app.inject({ method: 'POST', url: '/api/auth/login-pin', payload: { pin } });
  if (r.statusCode !== 200) throw new Error(`Login fallido (${r.statusCode}): ${r.body}`);
  return r.json().accessToken;
}

/** Atajo para llamar a la API autenticado. */
export function api(app: FastifyInstance, token: string) {
  const cabecera = { authorization: `Bearer ${token}` };
  return {
    get: (url: string) => app.inject({ method: 'GET', url, headers: cabecera }),
    post: (url: string, payload?: unknown) =>
      app.inject({ method: 'POST', url, headers: cabecera, payload: payload ?? {} }),
    patch: (url: string, payload?: unknown) =>
      app.inject({ method: 'PATCH', url, headers: cabecera, payload: payload ?? {} }),
    put: (url: string, payload?: unknown) =>
      app.inject({ method: 'PUT', url, headers: cabecera, payload: payload ?? {} }),
    del: (url: string, payload?: unknown) =>
      app.inject({ method: 'DELETE', url, headers: cabecera, payload: payload ?? {} }),
  };
}
