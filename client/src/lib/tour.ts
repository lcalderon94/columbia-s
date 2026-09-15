import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { guiaPorId, type PasoGuia } from './guias';
import { api } from './api';

let activo: Driver | null = null;
let vigilante: number | null = null;

export interface OpcionesTour {
  guiaId: string;
  pedidoId?: string;
  alTerminar?: (completada: boolean) => void;
}

function dejarDeVigilar(): void {
  if (vigilante !== null) {
    window.clearInterval(vigilante);
    vigilante = null;
  }
}

/**
 * Convierte un paso de la guía en un paso de driver.js.
 *
 * Los pasos con `hazlo` no llevan botón de "Siguiente": el empleado tiene que
 * hacer de verdad lo que se le pide y la guía avanza sola al detectarlo. Es
 * la diferencia entre ver una demostración y aprender a manejar el programa.
 */
function aPasoDriver(paso: PasoGuia): DriveStep {
  const obligatorio = !!paso.hazlo;
  const instruccion = obligatorio
    ? `<div class="guia-tarea"><span class="guia-tarea-punto"></span><div><strong>Hazlo tú:</strong> ${paso.hazlo!.instruccion}</div></div>`
    : '';

  return {
    element: paso.elemento,
    popover: {
      title: paso.titulo,
      description: `${paso.texto}${instruccion}`,
      side: paso.lado ?? 'bottom',
      align: 'start',
      // Sin "Siguiente": la única salida es hacer la tarea (o cerrar la guía)
      showButtons: obligatorio ? ['previous', 'close'] : ['previous', 'next', 'close'],
    },
  };
}

export function lanzarGuia({ guiaId, pedidoId, alTerminar }: OpcionesTour): void {
  const guia = guiaPorId(guiaId);
  if (!guia) return;

  cerrarGuia();

  // Solo se descartan los pasos marcados como dependientes del estado (el
  // botón de abrir caja si la caja ya está abierta, por ejemplo). El resto se
  // deja: driver.js busca el elemento al llegar a cada paso, y hay campos que
  // aparecen a mitad de guía, como el "entregado" al elegir efectivo. Si se
  // filtraran todos al arrancar, esos pasos se perderían.
  const pasos = guia
    .pasos({ pedidoId })
    .filter((p) => !p.soloSiExiste || !p.elemento || document.querySelector(p.elemento) !== null);
  if (pasos.length === 0) return;

  let completada = false;
  let miGuia: Driver | null = null;

  /** Espera a que el empleado haga la tarea y entonces avanza. */
  const vigilarTarea = (indice: number) => {
    dejarDeVigilar();
    const tarea = pasos[indice]?.hazlo;
    if (!tarea) return;

    vigilante = window.setInterval(() => {
      let hecho = false;
      try {
        hecho = tarea.comprobar();
      } catch {
        hecho = false;
      }
      if (!hecho) return;
      dejarDeVigilar();
      // Un respiro para que se vea el resultado de lo que acaba de hacer
      window.setTimeout(() => {
        if (activo !== miGuia) return;
        if (indice >= pasos.length - 1) {
          completada = true;
          miGuia?.destroy();
        } else {
          miGuia?.moveNext();
        }
      }, 650);
    }, 250);
  };

  miGuia = driver({
    showProgress: true,
    allowClose: true,
    // Un clic fuera no cierra la guía: en los pasos con tarea es fácil fallar
    // el objetivo y sería muy molesto perder el avance por eso.
    overlayClickBehavior: () => {},
    overlayColor: '#0f172a',
    overlayOpacity: 0.7,
    stagePadding: 6,
    stageRadius: 10,
    popoverClass: 'guia-columbias',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atrás',
    doneBtnText: 'Terminar',
    progressText: '{{current}} de {{total}}',
    steps: pasos.map(aPasoDriver),
    onHighlighted: (_el, _paso, opciones) => {
      vigilarTarea(opciones.state.activeIndex ?? 0);
      // La pantalla puede moverse justo al entrar en el paso (al vaciar el
      // buscador reaparecen las categorías, por ejemplo). Sin recolocar, el
      // diálogo se queda encima del botón que hay que pulsar.
      window.setTimeout(() => {
        if (activo === miGuia) miGuia?.refresh();
      }, 120);
    },
    onDeselected: () => dejarDeVigilar(),
    onDoneClick: () => {
      completada = true;
      miGuia?.destroy();
    },
    onCloseClick: () => {
      miGuia?.destroy();
    },
    onDestroyed: () => {
      dejarDeVigilar();
      // Sólo se limpia la referencia si sigue siendo la propia: el aviso de
      // destrucción de una guía anterior llega tarde y dejaría sin referencia
      // a la que se acaba de abrir.
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
  dejarDeVigilar();
  if (activo) {
    const a = activo;
    activo = null;
    a.destroy();
  }
}

export const hayGuiaActiva = () => activo !== null;
