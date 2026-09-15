/**
 * Crea el fichero .env a partir de .env.example la primera vez.
 *
 * El .env no va al repositorio (lleva la clave de firma de sesiones), así que
 * en un clon recién hecho no existe y Prisma no sabría dónde está la base de
 * datos. Además genera una clave JWT aleatoria, para que dos instalaciones
 * distintas no compartan la misma.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const destino = path.join(raiz, '.env');
const plantilla = path.join(raiz, '.env.example');

if (fs.existsSync(destino)) {
  console.log('  .env ya existe, no se toca');
  process.exit(0);
}

if (!fs.existsSync(plantilla)) {
  console.error('  Falta .env.example: no se puede preparar la configuración');
  process.exit(1);
}

const clave = crypto.randomBytes(32).toString('hex');
const contenido = fs
  .readFileSync(plantilla, 'utf8')
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET="${clave}"`);

fs.writeFileSync(destino, contenido, 'utf8');
console.log('  .env creado con una clave de sesión nueva');
