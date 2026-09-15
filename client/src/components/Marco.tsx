import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSesion } from '../lib/sesion';
import { api } from '../lib/api';
import { eur } from '../lib/formato';
import type { ResumenHoy } from '../lib/tipos';

interface Enlace {
  a: string;
  texto: string;
  permiso: string;
  icono: ReactNode;
}

const Icono = ({ d }: { d: string }) => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ENLACES: Enlace[] = [
  { a: '/sala', texto: 'Sala', permiso: 'sala.ver', icono: <Icono d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" /> },
  { a: '/reservas', texto: 'Reservas', permiso: 'reservas.ver', icono: <Icono d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /> },
  { a: '/cocina', texto: 'Cocina', permiso: 'cocina.ver', icono: <Icono d="M8 2v7a4 4 0 0 0 8 0V2M12 13v9M6 2v4M10 2v4" /> },
  { a: '/barra', texto: 'Barra', permiso: 'cocina.ver', icono: <Icono d="M3 3h18l-8 9v7h3M8 19h3v-7L3 3" /> },
  { a: '/juegos', texto: 'Ludoteca', permiso: 'juegos.ver', icono: <Icono d="M4 6h16v12H4zM9 10h.01M15 14h.01M9 14h.01M15 10h.01" /> },
  { a: '/caja', texto: 'Caja', permiso: 'caja.ver', icono: <Icono d="M3 7h18v12H3zM3 7l2-4h14l2 4M9 12h6" /> },
  { a: '/facturas', texto: 'Facturas', permiso: 'factura.emitir', icono: <Icono d="M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h4" /> },
  { a: '/informes', texto: 'Informes', permiso: 'informes.ver', icono: <Icono d="M3 3v18h18M7 15v3M12 9v9M17 5v13" /> },
  { a: '/admin', texto: 'Ajustes', permiso: 'usuarios.ver', icono: <Icono d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.6 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /> },
];

export default function Marco({ children }: { children: ReactNode }) {
  const { usuario, salir, puede } = useSesion();
  const navegar = useNavigate();

  const { data: hoy } = useQuery<ResumenHoy>({
    queryKey: ['hoy'],
    queryFn: () => api.get('/informes/hoy'),
    refetchInterval: 60_000,
    enabled: puede('pedidos.ver'),
  });

  const visibles = ENLACES.filter((e) => puede(e.permiso));

  const cerrar = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* da igual si falla: la sesión local se limpia igualmente */
    }
    salir();
    navegar('/entrar', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="flex w-20 flex-col items-center gap-1 bg-marca-950 py-3 lg:w-52 lg:items-stretch lg:px-3">
        <div className="mb-3 px-1 text-center lg:text-left">
          <p className="text-lg font-bold tracking-tight text-white">
            Columbia<span className="text-marca-400">'s</span>
          </p>
          <p className="hidden text-[11px] uppercase tracking-widest text-marca-400 lg:block">
            Board Game Café
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {visibles.map((e) => (
            <NavLink
              key={e.a}
              to={e.a}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-medium transition lg:flex-row lg:gap-3 lg:text-sm ${
                  isActive
                    ? 'bg-marca-600 text-white'
                    : 'text-marca-100/70 hover:bg-marca-900 hover:text-white'
                }`
              }
            >
              {e.icono}
              <span>{e.texto}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={cerrar}
          className="mt-2 flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-medium text-marca-100/70 transition hover:bg-marca-900 hover:text-white lg:flex-row lg:gap-3 lg:text-sm"
        >
          <Icono d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          <span>Salir</span>
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-4 text-sm">
            {hoy && (
              <>
                {/* La recaudación no se enseña en las tablets de cocina y barra:
                    están colgadas a la vista de todo el mundo. */}
                {puede('caja.ver') && <Dato titulo="Venta hoy" valor={eur(hoy.ventaCent)} />}
                <Dato titulo="Mesas" valor={`${hoy.mesas.ocupadas}/${hoy.mesas.total}`} />
                <Dato titulo="Abiertos" valor={String(hoy.pedidosAbiertos)} />
                {hoy.ticketsPendientes > 0 && (
                  <Dato titulo="En cocina" valor={String(hoy.ticketsPendientes)} alerta />
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight text-slate-800">{usuario?.nombre}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{usuario?.rol}</p>
            </div>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: usuario?.color ?? '#0f766e' }}
            >
              {usuario?.nombre.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function Dato({ titulo, valor, alerta }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="hidden sm:block">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className={`tabular text-sm font-bold ${alerta ? 'text-rose-600' : 'text-slate-800'}`}>
        {valor}
      </p>
    </div>
  );
}
