import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Carga el fichero .env antes de leer la configuración.
 *
 * Node no lo hace solo: sin esto, todo lo que el local configurase en .env
 * (el puerto, la carpeta de recibos y, sobre todo, la clave con la que se
 * firman las sesiones) se ignoraba en silencio y se usaban los valores por
 * defecto del código, iguales en todas las instalaciones.
 *
 * Se busca en la raíz del servidor, que es donde lo deja la instalación,
 * tanto ejecutando desde `src` (desarrollo) como desde `dist` (local).
 */
function cargarEnv(): void {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const candidatos = [
    path.resolve(aqui, '../../.env'), // dist/lib -> server/.env
    path.resolve(aqui, '../../../.env'), // src/lib -> server/.env
    path.resolve(process.cwd(), '.env'),
  ];
  for (const ruta of candidatos) {
    if (!fs.existsSync(ruta)) continue;
    try {
      process.loadEnvFile(ruta);
      return;
    } catch (e) {
      console.warn(`[env] no se pudo leer ${ruta}:`, e);
    }
  }
}

cargarEnv();

const esquema = z.object({
  DATABASE_URL: z.string().default('file:./columbias.db'),
  JWT_SECRET: z.string().min(16).default('columbias-clave-desarrollo-cambiala-ya'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DIR_RECIBOS: z.string().default('./datos/recibos'),
  NODE_ENV: z.string().default('development'),
});

export const env = esquema.parse(process.env);

/** Avisa si el local sigue firmando las sesiones con la clave de ejemplo. */
export const claveDeEjemplo = env.JWT_SECRET === 'columbias-clave-desarrollo-cambiala-ya';
