import dayjs from 'dayjs';
import 'dayjs/locale/es';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('es');
dayjs.extend(relativeTime);

export { dayjs };

const EUROS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export const eur = (cent: number | null | undefined): string => EUROS.format((cent ?? 0) / 100);

/** Convierte "12,50" o "12.50" en 1250 céntimos. */
export function aCentimos(texto: string): number {
  const limpio = texto.replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = Number.parseFloat(limpio);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const hora = (f: string | Date) => dayjs(f).format('HH:mm');
export const fechaHora = (f: string | Date) => dayjs(f).format('DD/MM/YYYY HH:mm');
export const fechaCorta = (f: string | Date) => dayjs(f).format('DD/MM');
export const desde = (f: string | Date) => dayjs(f).fromNow();

export function minutosDesde(f: string | Date): number {
  return Math.floor((Date.now() - new Date(f).getTime()) / 60000);
}

export const ETIQUETA_ESTADO_MESA: Record<string, string> = {
  LIBRE: 'Libre',
  OCUPADA: 'Ocupada',
  RESERVADA: 'Reservada',
  LIMPIEZA: 'Por limpiar',
  FUERA_SERVICIO: 'Fuera de servicio',
};

export const ETIQUETA_ESTADO_RESERVA: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  SENTADA: 'Sentada',
  COMPLETADA: 'Completada',
  NO_SHOW: 'No se presentó',
  CANCELADA: 'Cancelada',
};

export const ETIQUETA_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  BIZUM: 'Bizum',
  VALE: 'Vale',
  INVITACION: 'Invitación',
};

export const ETIQUETA_ROL: Record<string, string> = {
  ADMIN: 'Administrador',
  ENCARGADO: 'Encargado',
  CAMARERO: 'Camarero',
  COCINA: 'Cocina',
  BARRA: 'Barra',
};
