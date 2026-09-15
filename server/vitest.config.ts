import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test',
      JWT_SECRET: 'clave-de-pruebas-columbias-0123456789',
      DIR_RECIBOS: './datos/recibos-test',
    },
    globalSetup: './tests/preparar.ts',
    // Las pruebas comparten una sola base SQLite: van en serie a proposito.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
