import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { guiaPorId } from './guias';
import { api } from './api';

let activo: Driver | null = null;

export interface OpcionesTour {
  guiaId: string;
  pedidoId?: string;
  alTerminar?: (completada: boolean) => void;
}

/**
 * Lanza una guía sobre la pantalla real.
 *
 * Los pasos se enganchan a los elementos con `data-guia`. Si alguno no está
 * en pantalla (porque ese botón depende del rol o del estado del pedido) se
 * salta, en vez de dejar la guía colgada señalando al vacío.
 */
export function lanzarGuia({ guiaId, pedidoId, alTerminar }: OpcionesTour): void {
  const guia = guiaPorId(guiaId);
  if (!guia) return;

  cerrarGuia();

  const pasos = guia.pasos({ pedidoId }).filter((p) => {
    if (!p.element) return true; // tarjeta centrada: siempre vale
    return document.querySelector(p.element as string) !== null;
  });
  if (pasos.length === 0) return;

  // Sólo cuenta como completada si pulsa "Terminar" en el último paso.
  // driver.js avisa de ello con onDoneClick, que es una señal explícita:
  // deducirlo del índice del paso fallaba según cómo se cerrara la guía.
  //
  // Ojo: al definir onDoneClick y onCloseClick, driver.js deja de cerrarse
  // solo y hay que llamar a destroy() a mano.
  let completada = false;
  // `miGuia` apunta a ESTA guía. Sin ella, el onDestroyed de la guía anterior
  // llegaba tarde y ponía `activo` a null cuando ya apuntaba a la nueva, y la
  // nueva se quedaba sin referencia: al pulsar Terminar no se cerraba ni se
  // guardaba el progreso. Solo se limpia si `activo` sigue siendo uno mismo.
  let miGuia: Driver | null = null;

  miGuia = driver({
    showProgress: true,
    allowClose: true,
    overlayColor: '#0f172a',
    overlayOpacity: 0.7,
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: 'guia-columbias',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atrás',
    doneBtnText: 'Terminar',
    progressText: '{{current}} de {{total}}',
    steps: pasos,
    onDoneClick: () => {
      completada = true;
      miGuia?.destroy();
    },
    onCloseClick: () => {
      miGuia?.destroy();
    },
    onDestroyed: () => {
      if (activo === miGuia) activo = null;
      alTerminar?.(completada);
    },
  });

  activo = miGuia;
  miGuia.drive();
}

/**
 * Apunta que el empleado terminó la guía.
 *
 * Va por `api` directamente y no por una mutación de React Query: la guía
 * casi siempre acaba en una pantalla distinta de la que la lanzó, así que
 * para entonces el componente que la arrancó ya no existe y su mutación no
 * llegaría a ejecutarse.
 */
export async function marcarGuiaCompletada(guiaId: string): Promise<void> {
  try {
    await api.post(`/formacion/${guiaId}/completada`);
  } catch {
    // Que no se guarde el progreso no debe estropearle la guía a nadie
  }
}

export function cerrarGuia(): void {
  if (activo) {
    const a = activo;
    activo = null;
    a.destroy();
  }
}

export const hayGuiaActiva = () => activo !== null;
