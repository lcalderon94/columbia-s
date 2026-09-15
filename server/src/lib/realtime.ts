import type { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function registrarIo(servidor: SocketServer): void {
  io = servidor;
}

/**
 * Canales usados por las pantallas:
 *  - `sala`    -> cambios de estado de mesas y pedidos
 *  - `cocina`  -> tickets con destino COCINA
 *  - `barra`   -> tickets con destino BARRA
 *  - `caja`    -> cobros y movimientos de caja
 */
export type Canal = 'sala' | 'cocina' | 'barra' | 'caja' | 'reservas' | 'juegos';

export function emitir(canal: Canal, evento: string, datos: unknown): void {
  io?.to(canal).emit(evento, datos);
}

export function emitirDestino(destino: string, evento: string, datos: unknown): void {
  if (destino === 'COCINA') emitir('cocina', evento, datos);
  else if (destino === 'BARRA') emitir('barra', evento, datos);
}
