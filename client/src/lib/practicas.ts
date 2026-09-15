import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Modo prácticas. Mientras está activo, los pedidos que se abren se marcan
 * como formación: se comportan igual en sala y en cocina, pero nunca emiten
 * factura, no tocan la caja y no cuentan como venta. Al terminar se borran.
 */
interface EstadoPracticas {
  activo: boolean;
  activar: () => void;
  desactivar: () => void;
}

export const usePracticas = create<EstadoPracticas>()(
  persist(
    (set) => ({
      activo: false,
      activar: () => set({ activo: true }),
      desactivar: () => set({ activo: false }),
    }),
    { name: 'columbias-practicas' },
  ),
);
