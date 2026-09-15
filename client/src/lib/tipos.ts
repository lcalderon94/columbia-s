// Tipos que devuelve la API. Reflejan lo que mapea el servidor.

export interface Alergeno {
  id: string;
  nombre: string;
}

export interface Modificador {
  id: string;
  nombre: string;
  precioCent: number;
}

export interface GrupoModificador {
  id: string;
  nombre: string;
  min: number;
  max: number;
  modificadores: Modificador[];
}

export interface Producto {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  precioCent: number;
  ivaTipo: number;
  destino: string | null;
  tipo: 'NORMAL' | 'COVER';
  vegano: boolean;
  picante: boolean;
  kids: boolean;
  sinGlutenDisponible: boolean;
  activo: boolean;
  orden: number;
  codigoRapido: string | null;
  alergenos: Alergeno[];
  gruposModificador: GrupoModificador[];
}

export interface Categoria {
  id: string;
  nombre: string;
  orden: number;
  destino: string;
  color: string;
  activa: boolean;
  productos: Producto[];
}

export interface MesaResumen {
  id: string;
  zonaId: string;
  nombre: string;
  capacidad: number;
  forma: string;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  estado: string;
  activa: boolean;
  unidaAId: string | null;
  unidas: { id: string; nombre: string }[];
  pedido: {
    id: string;
    numero: number;
    estado: string;
    comensales: number;
    abiertoEn: string;
    camarero: string | null;
    totalCent: number;
    lineasPendientes: number;
  } | null;
  reservaProxima: {
    id: string;
    clienteNombre: string;
    fecha: string;
    personas: number;
  } | null;
  juegosEnMesa: { id: string; juego: string; inicioEn: string }[];
}

export interface Zona {
  id: string;
  nombre: string;
  orden: number;
  color: string;
  activa: boolean;
  mesas: MesaResumen[];
}

export interface Sala {
  zonas: Zona[];
  resumen: {
    total: number;
    libres: number;
    ocupadas: number;
    reservadas: number;
    comensales: number;
  };
}

export interface LineaPedido {
  id: string;
  productoId: string | null;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  precioUnitCent: number;
  modificadorCent: number;
  modificadores: { nombre: string; precioCent: number }[];
  ivaTipo: number;
  notas: string | null;
  estado: string;
  destino: string;
  curso: number;
  invitada: boolean;
  descuentoTipo: string | null;
  descuentoValor: number;
  anuladaMotivo: string | null;
  ticketId: string | null;
  creadoEn: string;
  enviadoEn: string | null;
  brutoCent: number;
  totalCent: number;
}

export interface Desglose {
  ivaTipo: number;
  baseCent: number;
  cuotaCent: number;
  totalCent: number;
}

export interface TotalesPedido {
  brutoCent: number;
  descuentoLineasCent: number;
  descuentoPedidoCent: number;
  descuentoTotalCent: number;
  invitadoCent: number;
  totalCent: number;
  baseCent: number;
  cuotaCent: number;
  desglose: Desglose[];
  cobradoCent: number;
  pendienteCent: number;
  propinaCent: number;
}

export interface Pedido {
  id: string;
  numero: number;
  tipo: string;
  estado: string;
  comensales: number;
  notas: string | null;
  abiertoEn: string;
  cerradoEn: string | null;
  descuentoTipo: string | null;
  descuentoValor: number;
  descuentoMotivo: string | null;
  mesa: { id: string; nombre: string; zona: { id: string; nombre: string }; capacidad: number } | null;
  camarero: { id: string; nombre: string; color: string } | null;
  lineas: LineaPedido[];
  tickets: { id: string; destino: string; numeroRonda: number; estado: string; creadoEn: string }[];
  pagos: {
    id: string;
    metodo: string;
    importeCent: number;
    propinaCent: number;
    creadoEn: string;
    ultimos4: string | null;
    refAutorizacion: string | null;
  }[];
  facturas: { id: string; codigo: string; tipo: string; estado: string; totalCent: number }[];
  juegos: { prestamoId: string; id: string; nombre: string; inicioEn: string }[];
  totales: TotalesPedido;
}

export interface TicketCocina {
  id: string;
  destino: string;
  numeroRonda: number;
  estado: string;
  creadoEn: string;
  minutosEspera: number;
  pedido: {
    id: string;
    numero: number;
    tipo: string;
    comensales: number;
    notas: string | null;
    mesa: string | null;
    zona: string | null;
    camarero: string | null;
  };
  lineas: {
    id: string;
    nombre: string;
    cantidad: number;
    notas: string | null;
    curso: number;
    estado: string;
    modificadores: { nombre: string; precioCent: number }[];
  }[];
  anuladas: { id: string; nombre: string; cantidad: number }[];
}

export interface Reserva {
  id: string;
  codigo: string;
  clienteNombre: string;
  telefono: string | null;
  email: string | null;
  fecha: string;
  fin: string;
  duracionMin: number;
  personas: number;
  estado: string;
  origen: string;
  notas: string | null;
  juegoSolicitado: { id: string; nombre: string } | null;
  mesas: { id: string; nombre: string; capacidad: number; zonaId: string }[];
  pedido: { id: string; numero: number; estado: string } | null;
  creadoPor: { id: string; nombre: string } | null;
  creadoEn: string;
}

export interface Juego {
  id: string;
  nombre: string;
  descripcion: string | null;
  minJugadores: number;
  maxJugadores: number;
  duracionMin: number;
  complejidad: number;
  categoria: string | null;
  ubicacion: string | null;
  estado: string;
  notas: string | null;
  activo: boolean;
  prestamoActivo: {
    id: string;
    mesa: { id: string; nombre: string } | null;
    inicioEn: string;
  } | null;
}

export interface SesionCaja {
  id: string;
  numero: number;
  estado: string;
  abiertaEn: string;
  abiertaPor: { id: string; nombre: string };
  cerradaEn: string | null;
  cerradaPor: { id: string; nombre: string } | null;
  saldoInicialCent: number;
  saldoFinalContadoCent: number | null;
  descuadreCent: number | null;
  notas: string | null;
  desgloseArqueo: Record<string, number> | null;
  totales: {
    ventaTotalCent: number;
    efectivoCobradoCent: number;
    propinaTotalCent: number;
    entradasCent: number;
    salidasCent: number;
    saldoTeoricoCent: number;
    pedidosCobrados: number;
    ticketMedioCent: number;
  };
  porMetodo: { metodo: string; importeCent: number; propinaCent: number; num: number }[];
  movimientos: {
    id: string;
    tipo: string;
    importeCent: number;
    motivo: string;
    usuario: string | null;
    creadoEn: string;
  }[];
}

export interface Factura {
  id: string;
  codigo: string;
  tipo: string;
  fechaEmision: string;
  clienteNombre: string | null;
  clienteNif: string | null;
  baseCent: number;
  cuotaCent: number;
  totalCent: number;
  estado: string;
  pedidoNumero: number | null;
  emitidaPor: string | null;
  hash: string;
}

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string | null;
  rol: string;
  color: string;
  activo: boolean;
  creadoEn: string;
}

export interface ResumenHoy {
  ventaCent: number;
  propinaCent: number;
  pedidosCobrados: number;
  ticketMedioCent: number;
  pedidosAbiertos: number;
  reservasHoy: number;
  ticketsPendientes: number;
  juegosFuera: number;
  mesas: { total: number; libres: number; ocupadas: number };
  porMetodo: { metodo: string; importeCent: number }[];
}
