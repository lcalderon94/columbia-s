import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Evita que la tablet apague la pantalla mientras está la comanda a la vista.
 *
 * Usa la API Wake Lock del navegador, que solo existe en contextos seguros
 * (https o localhost). En el local se entra por http://<ip>:4000, así que lo
 * normal es que NO esté disponible: por eso el ajuste que de verdad manda es
 * poner el tiempo de espera de pantalla en "Nunca" en la propia tablet.
 * Aquí se intenta igualmente, para cuando sí se pueda.
 */
export function useEvitarSuspension(activo: boolean): { soportado: boolean; activa: boolean } {
  const bloqueo = useRef<WakeLockSentinel | null>(null);
  const [activa, setActiva] = useState(false);
  const soportado = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!activo || !soportado) return;
    let cancelado = false;

    const pedir = async () => {
      try {
        bloqueo.current = await navigator.wakeLock.request('screen');
        if (!cancelado) setActiva(true);
        bloqueo.current.addEventListener('release', () => setActiva(false));
      } catch {
        setActiva(false);
      }
    };

    // Al volver de segundo plano el bloqueo se pierde y hay que repetirlo.
    const alVolver = () => {
      if (document.visibilityState === 'visible') void pedir();
    };

    void pedir();
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', alVolver);
      void bloqueo.current?.release().catch(() => {});
      bloqueo.current = null;
    };
  }, [activo, soportado]);

  return { soportado, activa };
}

/** Pantalla completa, para dejar la tablet en modo quiosco. */
export function usePantallaCompleta(): { completa: boolean; alternar: () => void } {
  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    const alCambiar = () => setCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const alternar = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  return { completa, alternar };
}
