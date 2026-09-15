import { formatearEuros } from '../../lib/dinero.js';

export interface DatosLocal {
  nombre: string;
  razonSocial: string;
  nif: string;
  direccion: string;
  cp: string;
  ciudad: string;
  telefono: string;
  email: string;
}

export interface LineaRecibo {
  nombre: string;
  cantidad: number;
  precioUnitCent: number;
  totalCent: number;
  modificadores?: { nombre: string; precioCent: number }[];
  invitada?: boolean;
}

export interface DatosRecibo {
  codigo: string;
  tipo: string;
  fechaEmision: Date;
  local: DatosLocal;
  clienteNombre?: string | null;
  clienteNif?: string | null;
  clienteDireccion?: string | null;
  clienteCp?: string | null;
  clienteCiudad?: string | null;
  mesa?: string | null;
  camarero?: string | null;
  comensales?: number;
  pedidoNumero?: number;
  lineas: LineaRecibo[];
  desglose: { ivaTipo: number; baseCent: number; cuotaCent: number }[];
  descuentoCent: number;
  baseCent: number;
  cuotaCent: number;
  totalCent: number;
  propinaCent: number;
  pagos: { metodo: string; importeCent: number; ultimos4?: string | null; refAutorizacion?: string | null }[];
  cambioCent?: number;
  hash: string;
  rectificaA?: string | null;
  motivoRectificacion?: string | null;
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const fecha = (d: Date) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(d);

const ETIQUETA_TIPO: Record<string, string> = {
  SIMPLIFICADA: 'Factura simplificada',
  COMPLETA: 'Factura',
  RECTIFICATIVA: 'Factura rectificativa',
};

const ETIQUETA_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  BIZUM: 'Bizum',
  VALE: 'Vale',
  INVITACION: 'Invitación',
};

/**
 * Recibo en HTML pensado para impresora de tickets de 80 mm.
 * Se guarda en disco tal cual se imprime, que es lo que hay que conservar.
 */
export function generarReciboHtml(d: DatosRecibo): string {
  const filasLineas = d.lineas
    .map((l) => {
      const mods = (l.modificadores ?? [])
        .map(
          (m) =>
            `<div class="mod">+ ${esc(m.nombre)}${m.precioCent ? ` (${formatearEuros(m.precioCent)})` : ''}</div>`,
        )
        .join('');
      return `<tr>
  <td class="cant">${l.cantidad}</td>
  <td class="desc">${esc(l.nombre)}${mods}${l.invitada ? '<div class="mod">Invitación</div>' : ''}</td>
  <td class="imp">${formatearEuros(l.totalCent)}</td>
</tr>`;
    })
    .join('\n');

  const filasIva = d.desglose
    .map(
      (g) => `<tr>
  <td>${g.ivaTipo}%</td>
  <td class="imp">${formatearEuros(g.baseCent)}</td>
  <td class="imp">${formatearEuros(g.cuotaCent)}</td>
</tr>`,
    )
    .join('\n');

  const filasPago = d.pagos
    .map((p) => {
      const extra = p.ultimos4
        ? ` ****${esc(p.ultimos4)}`
        : p.refAutorizacion
          ? ` aut. ${esc(p.refAutorizacion)}`
          : '';
      return `<div class="fila"><span>${esc(ETIQUETA_METODO[p.metodo] ?? p.metodo)}${extra}</span><span>${formatearEuros(p.importeCent)}</span></div>`;
    })
    .join('\n');

  const bloqueCliente =
    d.tipo !== 'SIMPLIFICADA' || d.clienteNif
      ? `<div class="bloque">
  <div class="titulo-bloque">Cliente</div>
  <div>${esc(d.clienteNombre ?? '')}</div>
  ${d.clienteNif ? `<div>NIF: ${esc(d.clienteNif)}</div>` : ''}
  ${d.clienteDireccion ? `<div>${esc(d.clienteDireccion)}</div>` : ''}
  ${d.clienteCp || d.clienteCiudad ? `<div>${esc(d.clienteCp ?? '')} ${esc(d.clienteCiudad ?? '')}</div>` : ''}
</div>`
      : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(d.codigo)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", ui-monospace, monospace; font-size: 12px; width: 72mm; margin: 0 auto; color: #000; background: #fff; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; letter-spacing: 1px; }
  .sub { text-align: center; font-size: 10px; line-height: 1.4; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  .cant { width: 22px; }
  .imp { text-align: right; white-space: nowrap; }
  .mod { font-size: 10px; padding-left: 6px; color: #333; }
  .fila { display: flex; justify-content: space-between; gap: 8px; }
  .total { font-size: 16px; font-weight: bold; }
  .bloque { margin: 4px 0; font-size: 11px; }
  .titulo-bloque { font-weight: bold; text-transform: uppercase; font-size: 10px; }
  .pie { text-align: center; font-size: 9px; margin-top: 8px; line-height: 1.5; word-break: break-all; }
  .aviso { text-align:center; font-weight: bold; border: 1px solid #000; padding: 3px; margin: 6px 0; font-size: 11px; }
</style>
</head>
<body>
  <h1>${esc(d.local.nombre)}</h1>
  <div class="sub">
    ${esc(d.local.razonSocial)}<br>
    NIF: ${esc(d.local.nif)}<br>
    ${esc(d.local.direccion)}<br>
    ${esc(d.local.cp)} ${esc(d.local.ciudad)}<br>
    ${esc(d.local.telefono)}
  </div>
  <hr>
  <div class="fila"><strong>${esc(ETIQUETA_TIPO[d.tipo] ?? d.tipo)}</strong><strong>${esc(d.codigo)}</strong></div>
  <div class="fila"><span>${fecha(d.fechaEmision)}</span><span>${d.pedidoNumero ? `Pedido #${d.pedidoNumero}` : ''}</span></div>
  ${d.mesa ? `<div class="fila"><span>Mesa: ${esc(d.mesa)}</span><span>${d.comensales ? `${d.comensales} pax` : ''}</span></div>` : ''}
  ${d.camarero ? `<div class="fila"><span>Atendido por: ${esc(d.camarero)}</span></div>` : ''}
  ${d.rectificaA ? `<div class="aviso">Rectifica a ${esc(d.rectificaA)}${d.motivoRectificacion ? `<br>${esc(d.motivoRectificacion)}` : ''}</div>` : ''}
  ${bloqueCliente}
  <hr>
  <table>${filasLineas}</table>
  <hr>
  ${d.descuentoCent > 0 ? `<div class="fila"><span>Descuento</span><span>-${formatearEuros(d.descuentoCent)}</span></div>` : ''}
  <div class="fila total"><span>TOTAL</span><span>${formatearEuros(d.totalCent)}</span></div>
  ${d.propinaCent > 0 ? `<div class="fila"><span>Propina</span><span>${formatearEuros(d.propinaCent)}</span></div>` : ''}
  <hr>
  <div class="titulo-bloque">Desglose de IVA</div>
  <table>
    <tr><td>Tipo</td><td class="imp">Base</td><td class="imp">Cuota</td></tr>
    ${filasIva}
    <tr><td><strong>Total</strong></td><td class="imp"><strong>${formatearEuros(d.baseCent)}</strong></td><td class="imp"><strong>${formatearEuros(d.cuotaCent)}</strong></td></tr>
  </table>
  <hr>
  <div class="titulo-bloque">Cobro</div>
  ${filasPago}
  ${d.cambioCent ? `<div class="fila"><span>Cambio</span><span>${formatearEuros(d.cambioCent)}</span></div>` : ''}
  <div class="pie">
    Huella: ${esc(d.hash.slice(0, 32))}<br>
    ¡Gracias por jugar en ${esc(d.local.nombre)}!<br>
    ${esc(d.local.email)}
  </div>
</body>
</html>`;
}
