import { useEffect, type ReactNode } from 'react';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-marca-600" />
      {texto}
    </div>
  );
}

export function Vacio({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
      <p className="text-base font-semibold text-slate-700">{titulo}</p>
      {descripcion && <p className="max-w-sm text-sm text-slate-500">{descripcion}</p>}
      {accion}
    </div>
  );
}

export function Aviso({ children, tono = 'error' }: { children: ReactNode; tono?: 'error' | 'info' | 'ok' }) {
  const tonos = {
    error: 'bg-rose-50 text-rose-800 ring-rose-200',
    info: 'bg-sky-50 text-sky-800 ring-sky-200',
    ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  };
  return <div className={`rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${tonos[tono]}`}>{children}</div>;
}

export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
  ancho = 'max-w-lg',
  pie,
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: string;
  pie?: ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className={`relative flex max-h-[90vh] w-full ${ancho} flex-col rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{pie}</div>}
      </div>
    </div>
  );
}

/** Teclado numérico para importes y PIN en pantalla táctil. */
export function TecladoNumerico({
  onTecla,
  onBorrar,
  onLimpiar,
  conDecimal = false,
}: {
  onTecla: (d: string) => void;
  onBorrar: () => void;
  onLimpiar?: () => void;
  conDecimal?: boolean;
}) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', conDecimal ? ',' : '', '0', ''];
  return (
    <div className="grid grid-cols-3 gap-2">
      {teclas.map((t, i) =>
        t ? (
          <button
            key={i}
            onClick={() => onTecla(t)}
            className="rounded-lg bg-slate-100 py-4 text-xl font-semibold text-slate-800 transition hover:bg-slate-200 active:scale-95"
          >
            {t}
          </button>
        ) : i === 9 && onLimpiar ? (
          <button
            key={i}
            onClick={onLimpiar}
            className="rounded-lg bg-slate-100 py-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 active:scale-95"
          >
            C
          </button>
        ) : i === 11 ? (
          <button
            key={i}
            onClick={onBorrar}
            className="rounded-lg bg-slate-100 py-4 text-slate-600 transition hover:bg-slate-200 active:scale-95"
          >
            ⌫
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  );
}

const TONOS_CHIP: Record<string, string> = {
  LIBRE: 'bg-emerald-100 text-emerald-800',
  OCUPADA: 'bg-amber-100 text-amber-800',
  RESERVADA: 'bg-sky-100 text-sky-800',
  LIMPIEZA: 'bg-violet-100 text-violet-800',
  FUERA_SERVICIO: 'bg-slate-200 text-slate-600',
  ABIERTO: 'bg-amber-100 text-amber-800',
  PARA_COBRAR: 'bg-orange-100 text-orange-800',
  COBRADO: 'bg-emerald-100 text-emerald-800',
  ANULADO: 'bg-rose-100 text-rose-800',
  NUEVO: 'bg-rose-100 text-rose-800',
  EN_PREPARACION: 'bg-amber-100 text-amber-800',
  LISTO: 'bg-emerald-100 text-emerald-800',
  ENTREGADO: 'bg-slate-200 text-slate-600',
  PENDIENTE: 'bg-slate-200 text-slate-700',
  ENVIADO: 'bg-sky-100 text-sky-800',
  SERVIDO: 'bg-emerald-100 text-emerald-800',
  CONFIRMADA: 'bg-sky-100 text-sky-800',
  SENTADA: 'bg-amber-100 text-amber-800',
  COMPLETADA: 'bg-emerald-100 text-emerald-800',
  NO_SHOW: 'bg-rose-100 text-rose-800',
  CANCELADA: 'bg-slate-200 text-slate-600',
  DISPONIBLE: 'bg-emerald-100 text-emerald-800',
  PRESTADO: 'bg-amber-100 text-amber-800',
  MANTENIMIENTO: 'bg-violet-100 text-violet-800',
  PERDIDO: 'bg-rose-100 text-rose-800',
  EMITIDA: 'bg-emerald-100 text-emerald-800',
  ANULADA: 'bg-rose-100 text-rose-800',
};

export function Chip({ estado, texto }: { estado: string; texto?: string }) {
  return (
    <span className={`chip ${TONOS_CHIP[estado] ?? 'bg-slate-200 text-slate-700'}`}>
      {texto ?? estado}
    </span>
  );
}
