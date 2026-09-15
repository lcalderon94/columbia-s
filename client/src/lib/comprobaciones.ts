/**
 * Comprobaciones que miran la pantalla real para saber si el empleado ha
 * hecho lo que la guía le pedía.
 *
 * Se apoyan en atributos `data-guia` puestos a propósito en la interfaz, no
 * en clases de estilo: así un retoque visual no rompe la formación.
 */

const nodo = (selector: string) => document.querySelector(selector);

const textoDe = (selector: string): string => nodo(selector)?.textContent ?? '';

const valorDe = (selector: string): string =>
  (nodo(selector) as HTMLInputElement | null)?.value ?? '';

/** Compara ignorando tildes y mayúsculas: "caña" y "CANA" valen igual. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const contiene = (donde: string, que: string) =>
  normalizar(textoDe(donde)).includes(normalizar(que));

// --- Comanda ---------------------------------------------------------------

export const buscadorDice = (texto: string) => () =>
  normalizar(valorDe('[data-guia="buscador"]')).includes(normalizar(texto));

export const buscadorVacio = () =>
  ((nodo('[data-guia="buscador"]') as HTMLInputElement | null)?.value ?? '').trim() === '';

export const comandaTiene = (producto: string) => () =>
  contiene('[data-guia="comanda"]', producto);

export const comandaTieneAlguno = (productos: string[]) => () =>
  productos.some((p) => contiene('[data-guia="comanda"]', p));

/** Una línea enviada muestra su estado en la comanda. */
export const comandaEnviada = () => contiene('[data-guia="comanda"]', 'ENVIADO');

export const lineaConNota = () => {
  const comanda = nodo('[data-guia="comanda"]');
  return !!comanda?.querySelector('p.italic');
};

// --- Cobro -----------------------------------------------------------------

export const metodoElegido = (metodo: string) => () =>
  nodo(`[data-guia="cobro-metodo-${metodo.toLowerCase()}"][data-elegido="si"]`) !== null;

export const hayCambioCalculado = () => nodo('[data-guia="cobro-cambio"]') !== null;

export const entregadoEscrito = () => valorDe('[data-guia="cobro-entregado"]').trim().length > 0;

export const cobroTerminado = () => nodo('[data-guia="cobro-hecho"]') !== null;

// --- Caja ------------------------------------------------------------------

export const cajaAbierta = () => nodo('[data-guia="caja-efectivo"]') !== null;

export const dialogoArqueoAbierto = () => contiene('body', 'Arqueo y cierre de caja');

// --- Simulador de arqueo ---------------------------------------------------

export const simuladorAbierto = () => contiene('body', 'Simulador de arqueo');

export const simuladorContado = () => {
  const texto = textoDe('[data-guia="sim-resultado"]');
  const linea = texto.match(/Has contado([^]*?)€/);
  if (!linea) return false;
  const numero = linea[1].replace(/[^\d,]/g, '').replace(',', '.');
  return Number.parseFloat(numero) > 0;
};

export const simuladorCuadrado = () => contiene('body', 'Cuadra. Así es como tiene que quedar');

// --- Sala ------------------------------------------------------------------

export const enPantalla = (ruta: string) => () => window.location.pathname.startsWith(ruta);
