import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCanal, pitido } from '../lib/socket';
import { hora } from '../lib/formato';
import type { TicketCocina } from '../lib/tipos';
import { useEvitarSuspension, usePantallaCompleta } from '../hooks/pantalla';
import { Cargando, Vacio } from '../components/ui';

interface Respuesta {
  tickets: TicketCocina[];
  resumen: { nuevos: number; enPreparacion: number; listos: number; esperaMaxMin: number };
}

/** Pantalla de producción. Sirve igual para cocina y para barra. */
export default function Cocina({ destino }: { destino: 'COCINA' | 'BARRA' }) {
  const qc = useQueryClient();
  const [sonido, setSonido] = useState(true);
  const conocidos = useRef<Set<string>>(new Set());
  const { completa, alternar } = usePantallaCompleta();
  // La pantalla de producción está siempre a la vista: no debe apagarse.
  useEvitarSuspension(true);

  const { data, isLoading } = useQuery<Respuesta>({
    queryKey: ['cocina', destino],
    queryFn: () => api.get(`/cocina?destino=${destino}`),
    // Los minutos de espera tienen que subir solos aunque no llegue evento.
    refetchInterval: 20_000,
  });

  const refrescar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['cocina', destino] });
  }, [qc, destino]);
  useCanal([destino === 'COCINA' ? 'cocina' : 'barra'], refrescar);

  // Avisa solo de los tickets que no se habían visto todavía.
  useEffect(() => {
    if (!data) return;
    const nuevos = data.tickets.filter((t) => !conocidos.current.has(t.id));
    if (conocidos.current.size > 0 && nuevos.length > 0 && sonido) pitido();
    conocidos.current = new Set(data.tickets.map((t) => t.id));
  }, [data, sonido]);

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      api.post(`/cocina/${id}/estado`, { estado }),
    onSuccess: refrescar,
  });

  if (isLoading || !data) return <Cargando texto="Cargando comandas…" />;

  const columnas = [
    { estado: 'NUEVO', titulo: 'Nuevas', color: 'bg-rose-500' },
    { estado: 'EN_PREPARACION', titulo: 'En marcha', color: 'bg-amber-500' },
    { estado: 'LISTO', titulo: 'Listas para servir', color: 'bg-emerald-500' },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white">
            {destino === 'COCINA' ? '🍔 Cocina' : '🍹 Barra'}
          </h1>
          <div className="flex gap-3 text-sm">
            <span className="text-rose-400">{data.resumen.nuevos} nuevas</span>
            <span className="text-amber-400">{data.resumen.enPreparacion} en marcha</span>
            <span className="text-emerald-400">{data.resumen.listos} listas</span>
            {data.resumen.esperaMaxMin > 15 && (
              <span className="font-bold text-rose-400">
                ⚠ máx. {data.resumen.esperaMaxMin} min
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSonido((s) => !s)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-600"
          >
            {sonido ? '🔔 Aviso activado' : '🔕 Aviso apagado'}
          </button>
          <button
            onClick={alternar}
            title="Pantalla completa, para dejar la tablet fija en esta vista"
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-600"
          >
            {completa ? '↙ Salir' : '⛶ Pantalla completa'}
          </button>
        </div>
      </div>

      {data.tickets.length === 0 ? (
        <Vacio titulo="No hay comandas pendientes" descripcion="Todo servido. Buen trabajo." />
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-3">
          {columnas.map((col) => {
            const suyos = data.tickets.filter((t) => t.estado === col.estado);
            return (
              <div key={col.estado} className="flex min-h-0 flex-col">
                <div className={`mb-2 flex items-center justify-between rounded-lg ${col.color} px-3 py-1.5`}>
                  <span className="text-sm font-bold text-white">{col.titulo}</span>
                  <span className="rounded-full bg-white/25 px-2 text-sm font-bold text-white">
                    {suyos.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {suyos.map((t) => (
                    <TarjetaTicket
                      key={t.id}
                      ticket={t}
                      onAvanzar={(estado) => cambiarEstado.mutate({ id: t.id, estado })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TarjetaTicket({
  ticket,
  onAvanzar,
}: {
  ticket: TicketCocina;
  onAvanzar: (estado: string) => void;
}) {
  // El color del borde avisa de la espera de un vistazo.
  const urgencia =
    ticket.minutosEspera >= 20
      ? 'ring-rose-500'
      : ticket.minutosEspera >= 12
        ? 'ring-amber-500'
        : 'ring-slate-600';

  const siguiente =
    ticket.estado === 'NUEVO'
      ? { estado: 'EN_PREPARACION', texto: 'Empezar' }
      : ticket.estado === 'EN_PREPARACION'
        ? { estado: 'LISTO', texto: 'Marcar lista' }
        : { estado: 'ENTREGADO', texto: 'Entregada' };

  return (
    <div className={`rounded-lg bg-slate-800 p-3 ring-2 ${urgencia}`}>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-base font-bold text-white">
            {ticket.pedido.mesa ? `Mesa ${ticket.pedido.mesa}` : ticket.pedido.tipo}
          </p>
          <p className="text-[11px] text-slate-400">
            #{ticket.pedido.numero} · ronda {ticket.numeroRonda}
            {ticket.pedido.camarero && ` · ${ticket.pedido.camarero}`}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`tabular text-lg font-bold ${
              ticket.minutosEspera >= 20
                ? 'text-rose-400'
                : ticket.minutosEspera >= 12
                  ? 'text-amber-400'
                  : 'text-slate-300'
            }`}
          >
            {ticket.minutosEspera}′
          </p>
          <p className="text-[11px] text-slate-500">{hora(ticket.creadoEn)}</p>
        </div>
      </div>

      <ul className="mb-2 space-y-1.5">
        {ticket.lineas.map((l) => (
          <li key={l.id} className="flex gap-2">
            <span className="tabular shrink-0 rounded bg-slate-700 px-1.5 text-sm font-bold text-white">
              {l.cantidad}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-white">{l.nombre}</p>
              {l.modificadores.map((m, i) => (
                <p key={i} className="text-[11px] text-slate-400">
                  + {m.nombre}
                </p>
              ))}
              {l.notas && (
                <p className="text-[11px] font-semibold text-amber-300">⚠ {l.notas}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {ticket.anuladas.length > 0 && (
        <p className="mb-2 rounded bg-rose-900/40 px-2 py-1 text-[11px] text-rose-300">
          Anulado: {ticket.anuladas.map((a) => `${a.cantidad}× ${a.nombre}`).join(', ')}
        </p>
      )}

      {ticket.pedido.notas && (
        <p className="mb-2 text-[11px] italic text-sky-300">“{ticket.pedido.notas}”</p>
      )}

      <button
        onClick={() => onAvanzar(siguiente.estado)}
        className="w-full rounded-lg bg-marca-600 py-2 text-sm font-bold text-white transition hover:bg-marca-500 active:scale-[0.98]"
      >
        {siguiente.texto}
      </button>
    </div>
  );
}
