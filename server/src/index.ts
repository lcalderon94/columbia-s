import { Server as SocketServer } from 'socket.io';
import { construirApp } from './app.js';
import { env } from './lib/env.js';
import { prisma } from './lib/db.js';
import { registrarIo, type Canal } from './lib/realtime.js';

const CANALES: Canal[] = ['sala', 'cocina', 'barra', 'caja', 'reservas', 'juegos'];

async function arrancar() {
  const app = await construirApp();

  const io = new SocketServer(app.server, {
    cors: { origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN.split(',') },
    path: '/socket',
  });

  // Cada pantalla se suscribe a los canales que le interesan: la de cocina
  // no recibe el ruido de caja y viceversa.
  io.on('connection', (socket) => {
    socket.on('suscribir', (canales: string[]) => {
      for (const canal of canales) {
        if (CANALES.includes(canal as Canal)) socket.join(canal);
      }
    });
    socket.on('desuscribir', (canales: string[]) => {
      for (const canal of canales) socket.leave(canal);
    });
  });
  registrarIo(io);

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Columbia's API escuchando en http://${env.HOST}:${env.PORT}`);

  const cerrar = async () => {
    app.log.info('Cerrando...');
    await io.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

arrancar().catch((e) => {
  console.error('No se pudo arrancar el servidor:', e);
  process.exit(1);
});
