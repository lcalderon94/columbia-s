import { z } from 'zod';

// ---------------------------------------------------------------------------
// Roles y permisos
// ---------------------------------------------------------------------------

export const ROLES = ['ADMIN', 'ENCARGADO', 'CAMARERO', 'COCINA', 'BARRA'] as const;
export type Rol = (typeof ROLES)[number];
export const zRol = z.enum(ROLES);

/**
 * Permisos del sistema. Cada endpoint declara el permiso que exige y el rol
 * del usuario decide si pasa. Mantener la matriz en un solo sitio hace que
 * "quien puede hacer que" sea auditable de un vistazo.
 */
export const PERMISOS = [
  'sala.ver',
  'sala.editar',
  'reservas.ver',
  'reservas.gestionar',
  'carta.ver',
  'carta.editar',
  'pedidos.ver',
  'pedidos.crear',
  'pedidos.anular_linea',
  'pedidos.descuento',
  'pedidos.invitar',
  'pedidos.transferir',
  'cocina.ver',
  'cocina.gestionar',
  'cobro.realizar',
  'cobro.anular',
  'factura.emitir',
  'factura.rectificar',
  'caja.ver',
  'caja.abrir',
  'caja.cerrar',
  'caja.movimiento',
  'juegos.ver',
  'juegos.gestionar',
  'usuarios.ver',
  'usuarios.gestionar',
  'informes.ver',
  'ajustes.editar',
] as const;
export type Permiso = (typeof PERMISOS)[number];

const TODOS: Permiso[] = [...PERMISOS];

export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  ADMIN: TODOS,
  // El encargado lo puede todo salvo tocar el equipo y los ajustes del local;
  // ver el equipo sí (ya viene incluido en la lista completa).
  ENCARGADO: TODOS.filter((p) => p !== 'usuarios.gestionar' && p !== 'ajustes.editar'),
  CAMARERO: [
    'sala.ver',
    'reservas.ver',
    'reservas.gestionar',
    'carta.ver',
    'pedidos.ver',
    'pedidos.crear',
    'pedidos.transferir',
    'cocina.ver',
    'cobro.realizar',
    'factura.emitir',
    'caja.ver',
    'juegos.ver',
    'juegos.gestionar',
  ],
  COCINA: ['carta.ver', 'cocina.ver', 'cocina.gestionar', 'pedidos.ver'],
  BARRA: ['carta.ver', 'cocina.ver', 'cocina.gestionar', 'pedidos.ver', 'sala.ver'],
};

export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol]?.includes(permiso) ?? false;
}

// ---------------------------------------------------------------------------
// Estados del dominio
// ---------------------------------------------------------------------------

export const ESTADOS_MESA = ['LIBRE', 'OCUPADA', 'RESERVADA', 'LIMPIEZA', 'FUERA_SERVICIO'] as const;
export const zEstadoMesa = z.enum(ESTADOS_MESA);

export const FORMAS_MESA = ['REDONDA', 'CUADRADA', 'RECTANGULAR', 'BARRA'] as const;
export const zFormaMesa = z.enum(FORMAS_MESA);

export const ESTADOS_RESERVA = [
  'PENDIENTE',
  'CONFIRMADA',
  'SENTADA',
  'COMPLETADA',
  'NO_SHOW',
  'CANCELADA',
] as const;
export const zEstadoReserva = z.enum(ESTADOS_RESERVA);

export const ORIGENES_RESERVA = ['LOCAL', 'TELEFONO', 'WEB'] as const;
export const zOrigenReserva = z.enum(ORIGENES_RESERVA);

export const DESTINOS = ['COCINA', 'BARRA', 'NINGUNO'] as const;
export const zDestino = z.enum(DESTINOS);

export const TIPOS_PEDIDO = ['MESA', 'BARRA', 'LLEVAR'] as const;
export const zTipoPedido = z.enum(TIPOS_PEDIDO);

export const ESTADOS_PEDIDO = ['ABIERTO', 'PARA_COBRAR', 'COBRADO', 'ANULADO'] as const;
export const zEstadoPedido = z.enum(ESTADOS_PEDIDO);

export const ESTADOS_LINEA = [
  'PENDIENTE',
  'ENVIADO',
  'EN_PREPARACION',
  'LISTO',
  'SERVIDO',
  'ANULADO',
] as const;
export const zEstadoLinea = z.enum(ESTADOS_LINEA);

export const ESTADOS_TICKET = ['NUEVO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'] as const;
export const zEstadoTicket = z.enum(ESTADOS_TICKET);

export const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'BIZUM', 'VALE', 'INVITACION'] as const;
export const zMetodoPago = z.enum(METODOS_PAGO);

export const TIPOS_FACTURA = ['SIMPLIFICADA', 'COMPLETA', 'RECTIFICATIVA'] as const;
export const zTipoFactura = z.enum(TIPOS_FACTURA);

export const TIPOS_MOVIMIENTO_CAJA = [
  'APERTURA',
  'VENTA',
  'ENTRADA',
  'SALIDA',
  'RETIRADA',
  'GASTO',
  'PROPINA',
  'CIERRE',
] as const;
export const zTipoMovimientoCaja = z.enum(TIPOS_MOVIMIENTO_CAJA);

export const ESTADOS_JUEGO = ['DISPONIBLE', 'PRESTADO', 'MANTENIMIENTO', 'PERDIDO'] as const;
export const zEstadoJuego = z.enum(ESTADOS_JUEGO);

export const TIPOS_DESCUENTO = ['PORCENTAJE', 'IMPORTE'] as const;
export const zTipoDescuento = z.enum(TIPOS_DESCUENTO);

export const IVAS_VALIDOS = [0, 4, 10, 21] as const;
export const zIva = z.union([z.literal(0), z.literal(4), z.literal(10), z.literal(21)]);

// Los 14 alergenos de declaracion obligatoria (Reglamento UE 1169/2011)
export const ALERGENOS: { id: string; nombre: string }[] = [
  { id: 'GLUTEN', nombre: 'Gluten' },
  { id: 'CRUSTACEOS', nombre: 'Crustáceos' },
  { id: 'HUEVOS', nombre: 'Huevos' },
  { id: 'PESCADO', nombre: 'Pescado' },
  { id: 'CACAHUETES', nombre: 'Cacahuetes' },
  { id: 'SOJA', nombre: 'Soja' },
  { id: 'LACTEOS', nombre: 'Lácteos' },
  { id: 'FRUTOS_SECOS', nombre: 'Frutos secos' },
  { id: 'APIO', nombre: 'Apio' },
  { id: 'MOSTAZA', nombre: 'Mostaza' },
  { id: 'SESAMO', nombre: 'Sésamo' },
  { id: 'SULFITOS', nombre: 'Sulfitos' },
  { id: 'ALTRAMUZ', nombre: 'Altramuz' },
  { id: 'MOLUSCOS', nombre: 'Moluscos' },
];

export interface UsuarioToken {
  id: string;
  nombre: string;
  rol: Rol;
}
