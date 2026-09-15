import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import estaticos from '@fastify/static';
import { ZodError } from 'zod';
import { env } from './lib/env.js';
import { origenesPermitidos } from './lib/origenes.js';
import { ErrorApp } from './lib/errores.js';

import rutasAuth from './modules/auth/rutas.js';
import rutasUsuarios from './modules/usuarios/rutas.js';
import rutasCarta from './modules/carta/rutas.js';
import rutasSala from './modules/sala/rutas.js';
import rutasReservas from './modules/reservas/rutas.js';
import rutasJuegos from './modules/juegos/rutas.js';
import rutasPedidos from './modules/pedidos/rutas.js';
import rutasCocina from './modules/cocina/rutas.js';
import rutasCobros from './modules/cobros/rutas.js';
import rutasCaja from './modules/caja/rutas.js';
import rutasInformes from './modules/informes/rutas.js';
import rutasFormacion from './modules/formacion/rutas.js';

export async function construirApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
    bodyLimit: 2 * 1024 * 1024,
  });

  // En el local todo va por la red de casa: el servidor sirve también la
  // aplicación, así que las tablets entran por el mismo origen. La lista de
  // orígenes es la misma que usa el WebSocket (ver lib/origenes.ts).
  await app.register(cors, { origin: origenesPermitidos(), credentials: true });
  await app.register(jwt, { secret: env.JWT_SECRET });

  // Traduce cualquier error a una respuesta con forma estable para el cliente.
  app.setErrorHandler((error, req, rep) => {
    if (error instanceof ErrorApp) {
      return rep.status(error.estado).send({
        error: error.message,
        codigo: error.codigo,
        detalle: error.detalle,
      });
    }
    if (error instanceof ZodError) {
      return rep.status(400).send({
        error: 'Datos no válidos',
        codigo: 'INVALIDO',
        detalle: error.flatten(),
      });
    }
    if ((error as any).code === 'P2002') {
      return rep.status(409).send({ error: 'Ya existe un registro igual', codigo: 'DUPLICADO' });
    }
    if ((error as any).code === 'P2025') {
      return rep.status(404).send({ error: 'No encontrado', codigo: 'NO_ENCONTRADO' });
    }
    const conEstado = error as { statusCode?: number; message?: string };
    if (conEstado.statusCode && conEstado.statusCode < 500) {
      return rep
        .status(conEstado.statusCode)
        .send({ error: conEstado.message ?? 'Error', codigo: 'ERROR' });
    }
    req.log.error(error);
    return rep.status(500).send({ error: 'Error interno del servidor', codigo: 'ERROR_INTERNO' });
  });

  app.get('/api/salud', async () => ({
    ok: true,
    servicio: "Columbia's API",
    version: '1.0.0',
    hora: new Date().toISOString(),
  }));

  await app.register(rutasAuth, { prefix: '/api/auth' });
  await app.register(rutasUsuarios, { prefix: '/api/usuarios' });
  await app.register(rutasCarta, { prefix: '/api/carta' });
  await app.register(rutasSala, { prefix: '/api/sala' });
  await app.register(rutasReservas, { prefix: '/api/reservas' });
  await app.register(rutasJuegos, { prefix: '/api/juegos' });
  await app.register(rutasPedidos, { prefix: '/api/pedidos' });
  await app.register(rutasCocina, { prefix: '/api/cocina' });
  await app.register(rutasCobros, { prefix: '/api/cobros' });
  await app.register(rutasCaja, { prefix: '/api/caja' });
  await app.register(rutasInformes, { prefix: '/api/informes' });
  await app.register(rutasFormacion, { prefix: '/api/formacion' });

  // -- Aplicación compilada -------------------------------------------------
  // Si existe client/dist se sirve desde aquí, para que el local tenga una
  // sola dirección (http://<ip-del-pc>:4000) que vale para el mostrador y
  // para las tablets de cocina y barra.
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const carpetaCliente = path.resolve(aqui, '../../client/dist');

  if (fs.existsSync(path.join(carpetaCliente, 'index.html'))) {
    await app.register(estaticos, { root: carpetaCliente, prefix: '/' });

    // La aplicación lleva sus propias rutas (/sala, /cocina...). Cualquier
    // dirección que no sea de la API devuelve el index y decide el navegador.
    app.setNotFoundHandler((req, rep) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/socket')) {
        return rep.status(404).send({ error: 'No encontrado', codigo: 'NO_ENCONTRADO' });
      }
      return rep.type('text/html').send(fs.readFileSync(path.join(carpetaCliente, 'index.html')));
    });
    app.log.info('Sirviendo la aplicación compilada desde client/dist');
  } else {
    app.log.warn('No hay client/dist: ejecuta "npm run build" para servir la aplicación');
  }

  return app;
}
