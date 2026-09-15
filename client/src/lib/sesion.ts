import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Usuario {
  id: string;
  nombre: string;
  rol: 'ADMIN' | 'ENCARGADO' | 'CAMARERO' | 'COCINA' | 'BARRA';
  color: string;
  email: string | null;
  permisos: string[];
}

interface EstadoSesion {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: Usuario | null;
  entrar: (datos: { accessToken: string; refreshToken: string; usuario: Usuario }) => void;
  salir: () => void;
  puede: (permiso: string) => boolean;
}

export const useSesion = create<EstadoSesion>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      entrar: ({ accessToken, refreshToken, usuario }) =>
        set({ accessToken, refreshToken, usuario }),
      salir: () => set({ accessToken: null, refreshToken: null, usuario: null }),
      puede: (permiso) => get().usuario?.permisos.includes(permiso) ?? false,
    }),
    { name: 'columbias-sesion' },
  ),
);

/** Pantalla de inicio segun el rol: cocina entra directa a su KDS. */
export function rutaInicial(rol: Usuario['rol']): string {
  if (rol === 'COCINA') return '/cocina';
  if (rol === 'BARRA') return '/barra';
  return '/sala';
}
