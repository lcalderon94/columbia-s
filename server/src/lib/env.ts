import { z } from 'zod';

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
