import os from 'node:os';
import { Server as SocketServer } from 'socket.io';
import { construirApp } from './app.js';
import { env } from './lib/env.js';
import { prisma } from './lib/db.js';
import { registrarIo, type Canal } from './lib/realtime.js';
import { origenesPermitidos } from './lib/origenes.js';

const CANALES: Canal[] = ['sala', 'cocina', 'barra', 'caja', 'reservas', 'juegos'];

async function arrancar() {
  const app = await construirApp();

  const io = new SocketServer(app.server, {
    cors: { origin: origenesPermitidos() },
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
  mostrarDirecciones();

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

/**
 * Escribe en pantalla las direcciones por las que se entra, incluida la IP
 * del PC en la red local: es lo que hay que teclear en las tablets de cocina
 * y barra la primera vez.
 */
function mostrarDirecciones(): void {
  const ips: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const red of interfaces ?? []) {
      if (red.family === 'IPv4' && !red.internal) ips.push(red.address);
    }
  }

  console.log('');
  console.log('  ===============================================');
  console.log("    Columbia's en marcha");
  console.log('  ===============================================');
  console.log('');
  console.log(`    En este PC:        http://localhost:${env.PORT}`);
  if (ips.length) {
    for (const ip of ips) {
      console.log(`    En las tablets:    http://${ip}:${env.PORT}`);
    }
    console.log('');
    console.log('    (las tablets tienen que estar en el mismo wifi)');
  } else {
    console.log('    Sin red detectada: las tablets no podrán conectarse.');
  }
  console.log('');
}

arrancar().catch((e) => {
  console.error('No se pudo arrancar el servidor:', e);
  process.exit(1);
});
