import { useSesion } from './sesion';

export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly codigo?: string,
    public readonly detalle?: unknown,
  ) {
    super(mensaje);
  }
}

let refrescando: Promise<boolean> | null = null;

/**
 * Renueva el token caducado. Si varias peticiones fallan a la vez solo se
 * lanza un refresco: las demas esperan a ese mismo.
 */
async function refrescar(): Promise<boolean> {
  if (refrescando) return refrescando;
  const { refreshToken, entrar, salir } = useSesion.getState();
  if (!refreshToken) return false;

  refrescando = (async () => {
    try {
      const r = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!r.ok) {
        salir();
        return false;
      }
      const datos = await r.json();
      entrar(datos);
      return true;
    } catch {
      salir();
      return false;
    } finally {
      refrescando = null;
    }
  })();
  return refrescando;
}

async function peticion<T>(
  metodo: string,
  url: string,
  cuerpo?: unknown,
  reintento = true,
): Promise<T> {
  const { accessToken } = useSesion.getState();
  const respuesta = await fetch(`/api${url}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  if (respuesta.status === 401 && reintento) {
    if (await refrescar()) return peticion<T>(metodo, url, cuerpo, false);
  }

  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`;
    let codigo: string | undefined;
    let detalle: unknown;
    try {
      const json = await respuesta.json();
      mensaje = json.error ?? mensaje;
      codigo = json.codigo;
      detalle = json.detalle;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ErrorApi(respuesta.status, mensaje, codigo, detalle);
  }

  if (respuesta.status === 204) return undefined as T;
  const texto = await respuesta.text();
  return texto ? (JSON.parse(texto) as T) : (undefined as T);
}

/**
 * Descarga un recurso de texto (el recibo en HTML) con la sesión puesta.
 * Una navegación normal del navegador no lleva la cabecera Authorization,
 * así que el recibo hay que traerlo por fetch y pintarlo después.
 */
async function texto(url: string, reintento = true): Promise<string> {
  const { accessToken } = useSesion.getState();
  const respuesta = await fetch(`/api${url}`, {
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
  if (respuesta.status === 401 && reintento) {
    if (await refrescar()) return texto(url, false);
  }
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, 'No se pudo abrir el documento');
  return respuesta.text();
}

/**
 * Abre el recibo en una ventana nueva y lanza el diálogo de impresión.
 * Pensado para la impresora de tickets de 80 mm.
 */
export async function imprimirRecibo(facturaId: string): Promise<void> {
  const html = await texto(`/cobros/facturas/${facturaId}/recibo`);
  const ventana = window.open('', '_blank', 'width=420,height=760');
  if (!ventana) {
    // El navegador ha bloqueado la ventana: se descarga el recibo.
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `recibo-${facturaId}.html`;
    enlace.click();
    URL.revokeObjectURL(url);
    return;
  }
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  // Se espera a que el navegador maquete antes de pedir la impresión.
  ventana.addEventListener('load', () => setTimeout(() => ventana.print(), 150));
}

export const api = {
  get: <T>(url: string) => peticion<T>('GET', url),
  texto,
  post: <T>(url: string, cuerpo?: unknown) => peticion<T>('POST', url, cuerpo ?? {}),
  patch: <T>(url: string, cuerpo?: unknown) => peticion<T>('PATCH', url, cuerpo ?? {}),
  put: <T>(url: string, cuerpo?: unknown) => peticion<T>('PUT', url, cuerpo ?? {}),
  del: <T>(url: string, cuerpo?: unknown) => peticion<T>('DELETE', url, cuerpo ?? {}),
};
