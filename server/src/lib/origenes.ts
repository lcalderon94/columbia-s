import { env } from './env.js';

/**
 * Orígenes admitidos, compartidos por la API y por el WebSocket.
 *
 * Vive aquí a propósito: tenerlo duplicado hizo que el WebSocket rechazara a
 * las tablets con un 403 mientras la API sí las aceptaba, y las comandas solo
 * llegaban al refrescar.
 *
 * Se permite:
 *  - lo que diga CLIENT_ORIGIN (el 5173 de desarrollo, por ejemplo)
 *  - cualquier dirección IP de la red local, que es como entran las tablets
 *    de cocina y barra (http://192.168.1.50:4000)
 */
const RED_LOCAL = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;

export function origenesPermitidos(): true | (string | RegExp)[] {
  if (env.CLIENT_ORIGIN === '*') return true;
  return [...env.CLIENT_ORIGIN.split(',').map((o) => o.trim()), RED_LOCAL];
}
