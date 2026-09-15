import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import dayjs from 'dayjs';
import { prisma, type Tx } from '../../lib/db.js';
import { env } from '../../lib/env.js';
import { noEncontrado, conflicto } from '../../lib/errores.js';
import { generarReciboHtml, type DatosLocal, type DatosRecibo } from './recibo.js';

const LOCAL_POR_DEFECTO: DatosLocal = {
  nombre: "Columbia's",
  razonSocial: "Columbia's Board Game Cafe S.L.",
  nif: 'B00000000',
  direccion: 'Calle sin definir 1',
  cp: '28001',
  ciudad: 'Madrid',
  telefono: '600 000 000',
  email: 'hola@columbias.es',
};

/** Datos fiscales del local, editables desde Ajustes. */
export async function datosLocal(tx: Tx = prisma): Promise<DatosLocal> {
  const filas = await tx.ajuste.findMany({ where: { clave: { startsWith: 'local.' } } });
  const mapa = Object.fromEntries(filas.map((f) => [f.clave.replace('local.', ''), f.valor]));
  return { ...LOCAL_POR_DEFECTO, ...mapa } as DatosLocal;
}

/**
 * Huella del registro de facturacion.
 *
 * Encadena cada factura con la anterior de su serie: si alguien altera una
 * factura pasada, todas las huellas posteriores dejan de cuadrar. Es la base
 * de un registro inalterable al estilo de lo que exige Veri*Factu. Ojo: esto
 * construye el encadenado, NO hace el envio a la AEAT (ver docs/facturacion.md).
 */
export function calcularHash(entrada: {
  codigo: string;
  nifEmisor: string;
  nifCliente?: string | null;
  fechaEmision: Date;
  totalCent: number;
  cuotaCent: number;
  hashAnterior?: string | null;
}): string {
  const cadena = [
    entrada.codigo,
    entrada.nifEmisor,
    entrada.nifCliente ?? '',
    dayjs(entrada.fechaEmision).toISOString(),
    String(entrada.totalCent),
    String(entrada.cuotaCent),
    entrada.hashAnterior ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(cadena, 'utf8').digest('hex').toUpperCase();
}

/** Ultima factura emitida (de cualquier serie): a ella se encadena la nueva. */
async function ultimaFactura(tx: Tx) {
  return tx.factura.findFirst({ orderBy: { creadoEn: 'desc' }, select: { hash: true } });
}

export async function guardarRecibo(codigo: string, html: string): Promise<string> {
  const anio = codigo.split('-')[1] ?? String(new Date().getFullYear());
  const dir = path.resolve(env.DIR_RECIBOS, anio);
  await fs.mkdir(dir, { recursive: true });
  const ruta = path.join(dir, `${codigo}.html`);
  await fs.writeFile(ruta, html, 'utf8');
  return ruta;
}

export interface DatosCliente {
  nombre?: string | null;
  nif?: string | null;
  direccion?: string | null;
  cp?: string | null;
  ciudad?: string | null;
}

export interface EmitirFacturaArgs {
  tx: Tx;
  pedidoId: string;
  tipo: 'SIMPLIFICADA' | 'COMPLETA' | 'RECTIFICATIVA';
  cliente?: DatosCliente;
  usuarioId: string;
  rectificaAId?: string;
  motivoRectificacion?: string;
  /** Importes negativos en la rectificativa completa. */
  signo?: 1 | -1;
}

/**
 * Emite una factura a partir de un pedido ya cobrado.
 * Reserva el numero de serie, congela las lineas y los cobros en JSON,
 * calcula la huella encadenada y deja el recibo escrito en disco.
 */
export async function emitirFactura(args: EmitirFacturaArgs) {
  const { tx, pedidoId, tipo, usuarioId } = args;
  const signo = args.signo ?? 1;

  const pedido = await tx.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      lineas: true,
      pagos: { where: { estado: 'COMPLETADO' } },
      mesa: true,
      camarero: { select: { nombre: true } },
    },
  });
  if (!pedido) throw noEncontrado('Pedido');

  const { calcularTotales } = await import('../pedidos/totales.js');
  const totales = calcularTotales(
    pedido.lineas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      cantidad: l.cantidad,
      precioUnitCent: l.precioUnitCent,
      modificadorCent: l.modificadorCent,
      ivaTipo: l.ivaTipo,
      estado: l.estado,
      invitada: l.invitada,
      descuentoTipo: l.descuentoTipo,
      descuentoValor: l.descuentoValor,
    })),
    pedido.descuentoTipo,
    pedido.descuentoValor,
  );

  const serieId = tipo === 'RECTIFICATIVA' ? 'R' : tipo === 'COMPLETA' ? 'F' : 'S';
  const serie = await tx.serieFactura.findUnique({ where: { id: serieId } });
  if (!serie) throw noEncontrado(`Serie de facturación ${serieId}`);

  const numero = serie.siguienteNumero;
  await tx.serieFactura.update({
    where: { id: serieId },
    data: { siguienteNumero: { increment: 1 } },
  });

  const anio = dayjs().format('YYYY');
  const codigo = `${serie.prefijo}-${anio}-${String(numero).padStart(6, '0')}`;
  const fechaEmision = new Date();
  const local = await datosLocal(tx);

  const lineasSnapshot = totales.lineas.map((l) => {
    const orig = pedido.lineas.find((o) => o.id === l.id)!;
    return {
      nombre: l.nombre,
      cantidad: l.cantidad,
      precioUnitCent: signo * (l.precioUnitCent + l.modificadorCent),
      totalCent: signo * l.totalCent,
      ivaTipo: l.ivaTipo,
      invitada: l.invitada,
      modificadores: orig.modificadoresJson ? JSON.parse(orig.modificadoresJson) : [],
    };
  });

  const desglose = totales.desglose.map((d) => ({
    ivaTipo: d.ivaTipo,
    baseCent: signo * d.baseCent,
    cuotaCent: signo * d.cuotaCent,
  }));

  const pagosSnapshot = pedido.pagos.map((p) => ({
    metodo: p.metodo,
    importeCent: signo * p.importeCent,
    propinaCent: signo * p.propinaCent,
    ultimos4: p.ultimos4,
    refAutorizacion: p.refAutorizacion,
  }));

  const baseCent = signo * totales.baseCent;
  const cuotaCent = signo * totales.cuotaCent;
  const totalCent = signo * totales.totalCent;
  const propinaCent = signo * pedido.pagos.reduce((a, p) => a + p.propinaCent, 0);

  const anterior = await ultimaFactura(tx);
  const hash = calcularHash({
    codigo,
    nifEmisor: local.nif,
    nifCliente: args.cliente?.nif ?? null,
    fechaEmision,
    totalCent,
    cuotaCent,
    hashAnterior: anterior?.hash ?? null,
  });

  const factura = await tx.factura.create({
    data: {
      serieId,
      numero,
      codigo,
      tipo,
      nifEmisor: local.nif,
      pedidoId,
      fechaEmision,
      clienteNombre: args.cliente?.nombre ?? null,
      clienteNif: args.cliente?.nif ?? null,
      clienteDireccion: args.cliente?.direccion ?? null,
      clienteCp: args.cliente?.cp ?? null,
      clienteCiudad: args.cliente?.ciudad ?? null,
      lineasJson: JSON.stringify(lineasSnapshot),
      desgloseJson: JSON.stringify(desglose),
      pagosJson: JSON.stringify(pagosSnapshot),
      baseCent,
      cuotaCent,
      totalCent,
      propinaCent,
      rectificaAId: args.rectificaAId ?? null,
      hash,
      hashAnterior: anterior?.hash ?? null,
      usuarioId,
    },
  });

  let rectificaACodigo: string | null = null;
  if (args.rectificaAId) {
    const original = await tx.factura.findUnique({ where: { id: args.rectificaAId } });
    rectificaACodigo = original?.codigo ?? null;
  }

  const datosRecibo: DatosRecibo = {
    codigo,
    tipo,
    fechaEmision,
    local,
    clienteNombre: args.cliente?.nombre,
    clienteNif: args.cliente?.nif,
    clienteDireccion: args.cliente?.direccion,
    clienteCp: args.cliente?.cp,
    clienteCiudad: args.cliente?.ciudad,
    mesa: pedido.mesa?.nombre ?? null,
    camarero: pedido.camarero?.nombre ?? null,
    comensales: pedido.comensales,
    pedidoNumero: pedido.numero,
    lineas: lineasSnapshot,
    desglose,
    descuentoCent: signo * totales.descuentoTotalCent,
    baseCent,
    cuotaCent,
    totalCent,
    propinaCent,
    pagos: pagosSnapshot,
    cambioCent: pedido.pagos.reduce((a, p) => a + (p.cambioCent ?? 0), 0) || undefined,
    hash,
    rectificaA: rectificaACodigo,
    motivoRectificacion: args.motivoRectificacion,
  };

  const html = generarReciboHtml(datosRecibo);
  const ruta = await guardarRecibo(codigo, html);
  await tx.factura.update({ where: { id: factura.id }, data: { rutaHtml: ruta } });

  return { ...factura, rutaHtml: ruta, html };
}

/**
 * Recorre la cadena de huellas y avisa del primer eslabon roto.
 * Es la comprobacion que se pasa antes de una inspeccion o un cierre anual.
 */
export async function verificarCadena(): Promise<{
  ok: boolean;
  total: number;
  rotaEn?: string;
  detalle?: string;
}> {
  const facturas = await prisma.factura.findMany({ orderBy: { creadoEn: 'asc' } });
  let anterior: string | null = null;

  for (const f of facturas) {
    if ((f.hashAnterior ?? null) !== anterior) {
      return {
        ok: false,
        total: facturas.length,
        rotaEn: f.codigo,
        detalle: 'El hash anterior no coincide con la factura precedente',
      };
    }
    const esperado = calcularHash({
      codigo: f.codigo,
      nifEmisor: f.nifEmisor,
      nifCliente: f.clienteNif,
      fechaEmision: f.fechaEmision,
      totalCent: f.totalCent,
      cuotaCent: f.cuotaCent,
      hashAnterior: f.hashAnterior,
    });
    if (esperado !== f.hash) {
      return {
        ok: false,
        total: facturas.length,
        rotaEn: f.codigo,
        detalle: 'La huella no coincide con el contenido de la factura',
      };
    }
    anterior = f.hash;
  }
  return { ok: true, total: facturas.length };
}
