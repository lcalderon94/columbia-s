import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Recrea una base de pruebas limpia y la rellena con la carta real. */
export async function setup() {
  const entorno = {
    ...process.env,
    DATABASE_URL: 'file:./test.db',
    NODE_ENV: 'test',
    JWT_SECRET: 'clave-de-pruebas-columbias-0123456789',
    DIR_RECIBOS: './datos/recibos-test',
  };
  const raiz = path.resolve(import.meta.dirname, '..');
  for (const f of ['test.db', 'test.db-journal']) {
    const ruta = path.join(raiz, 'prisma', f);
    if (fs.existsSync(ruta)) fs.rmSync(ruta);
  }
  // El fichero de pruebas se acaba de borrar, asi que un push normal basta
  // para crear el esquema desde cero.
  execSync('npx prisma db push --skip-generate', {
    cwd: raiz,
    env: entorno,
    stdio: 'pipe',
  });
  execSync('npx tsx prisma/seed.ts', { cwd: raiz, env: entorno, stdio: 'pipe' });
}

export async function teardown() {
  const raiz = path.resolve(import.meta.dirname, '..');
  const recibos = path.join(raiz, 'datos', 'recibos-test');
  if (fs.existsSync(recibos)) fs.rmSync(recibos, { recursive: true, force: true });
}
