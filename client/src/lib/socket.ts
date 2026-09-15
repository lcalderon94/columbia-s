import { io, type Socket } from 'socket.io-client';
import { useEffect } from 'react';

let socket: Socket | null = null;

function obtenerSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket', transports: ['websocket', 'polling'] });
  }
  return socket;
}

/**
 * Suscribe la pantalla a los canales que le interesan y ejecuta `alCambiar`
 * cuando llega cualquier evento de esos canales. Así la sala se refresca
 * sola al enviar una comanda desde otro puesto.
 */
export function useCanal(canales: string[], alCambiar: () => void): void {
  const clave = canales.join(',');
  useEffect(() => {
    const s = obtenerSocket();
    const lista = clave.split(',').filter(Boolean);

    const suscribir = () => s.emit('suscribir', lista);
    suscribir();
    s.on('connect', suscribir);

    const eventos = [
      'sala:recargar',
      'mesa:actualizada',
      'pedido:actualizado',
      'ticket:nuevo',
      'ticket:actualizado',
      'cocina:recargar',
      'caja:actualizada',
      'reserva:creada',
      'reserva:actualizada',
      'juego:actualizado',
    ];
    for (const e of eventos) s.on(e, alCambiar);

    return () => {
      s.off('connect', suscribir);
      for (const e of eventos) s.off(e, alCambiar);
      s.emit('desuscribir', lista);
    };
  }, [clave, alCambiar]);
}

/** Aviso sonoro para la pantalla de cocina, sin ficheros de audio. */
export function pitido(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.connect(gan);
    gan.connect(ctx.destination);
    osc.frequency.value = 880;
    gan.gain.setValueAtTime(0.15, ctx.currentTime);
    gan.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* el navegador puede bloquear el audio hasta que haya interacción */
  }
}
