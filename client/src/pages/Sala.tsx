import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../lib/api';
import { useCanal } from '../lib/socket';
import { useSesion } from '../lib/sesion';
import { usePracticas } from '../lib/practicas';
import { eur, hora, minutosDesde, ETIQUETA_ESTADO_MESA } from '../lib/formato';
import type { MesaResumen, Sala as TipoSala } from '../lib/tipos';
import { Cargando, Chip, Modal, Aviso } from '../components/ui';

const COLOR_ESTADO: Record<string, string> = {
  LIBRE: 'bg-white ring-slate-300 hover:ring-marca-500',
  OCUPADA: 'bg-amber-50 ring-amber-400',
  RESERVADA: 'bg-sky-50 ring-sky-400',
  LIMPIEZA: 'bg-violet-50 ring-violet-400',
  FUERA_SERVICIO: 'bg-slate-200 ring-slate-300 opacity-60',
};

export default function Sala() {
  const navegar = useNavigate();
  const qc = useQueryClient();
  const puede = useSesion((s) => s.puede);
  const enPracticas = usePracticas((s) => s.activo);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const [mesaSel, setMesaSel] = useState<MesaResumen | null>(null);
  const [comensales, setComensales] = useState(2);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TipoSala>({
    queryKey: ['sala'],
    queryFn: () => api.get('/sala'),
    refetchInterval: 30_000,
  });

  const refrescar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['sala'] });
    void qc.invalidateQueries({ queryKey: ['hoy'] });
  }, [qc]);
  useCanal(['sala'], refrescar);

  const abrirPedido = useMutation({
    mutationFn: (datos: { mesaId: string; comensales: number }) =>
      // En modo prácticas el pedido nace marcado: no facturará ni tocará caja
      api.post<{ id: string }>('/pedidos', { tipo: 'MESA', ...datos, esPractica: enPracticas }),
    onSuccess: (p) => {
      setMesaSel(null);
      navegar(`/pedido/${p.id}`);
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo abrir el pedido'),
  });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      api.post(`/sala/mesas/${id}/estado`, { estado }),
    onSuccess: () => {
      setMesaSel(null);
      refrescar();
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el estado'),
  });

  if (isLoading || !data) return <Cargando texto="Cargando sala…" />;

  const zonas = data.zonas;
  const zona = zonas.find((z) => z.id === zonaActiva) ?? zonas[0];

  const alTocarMesa = (m: MesaResumen) => {
    if (m.pedido) {
      navegar(`/pedido/${m.pedido.id}`);
      return;
    }
    if (m.estado === 'FUERA_SERVICIO') return;
    setError(null);
    setComensales(Math.min(m.capacidad, 2));
    setMesaSel(m);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div data-guia="zonas" className="flex flex-wrap gap-1.5">
          {zonas.map((z) => (
            <button
              key={z.id}
              onClick={() => setZonaActiva(z.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                z.id === zona?.id
                  ? 'bg-marca-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {z.nombre}
              <span className="ml-1.5 text-xs opacity-70">
                {z.mesas.filter((m) => m.estado === 'OCUPADA').length}/{z.mesas.length}
              </span>
            </button>
          ))}
        </div>
        <div data-guia="leyenda" className="flex items-center gap-3 text-sm">
          <Leyenda color="bg-white ring-slate-300" texto={`${data.resumen.libres} libres`} />
          <Leyenda color="bg-amber-50 ring-amber-400" texto={`${data.resumen.ocupadas} ocupadas`} />
          <Leyenda color="bg-sky-50 ring-sky-400" texto={`${data.resumen.reservadas} reservadas`} />
          <span className="tabular font-semibold text-slate-700">
            {data.resumen.comensales} comensales
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!zona || zona.mesas.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Esta zona no tiene mesas.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {zona.mesas.map((m, i) => (
              <TarjetaMesa key={m.id} mesa={m} indice={i} onTocar={() => alTocarMesa(m)} />
            ))}
          </div>
        )}
      </div>

      <Modal
        abierto={!!mesaSel}
        titulo={`Mesa ${mesaSel?.nombre ?? ''}`}
        onCerrar={() => setMesaSel(null)}
        pie={
          <>
            <button className="boton-secundario" onClick={() => setMesaSel(null)}>
              Cancelar
            </button>
            <button
              className="boton-primario"
              disabled={abrirPedido.isPending}
              onClick={() =>
                mesaSel && abrirPedido.mutate({ mesaId: mesaSel.id, comensales })
              }
            >
              {abrirPedido.isPending ? 'Abriendo…' : 'Abrir pedido'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Aviso>{error}</Aviso>}
          {mesaSel?.reservaProxima && (
            <Aviso tono="info">
              Reservada a las {hora(mesaSel.reservaProxima.fecha)} para{' '}
              {mesaSel.reservaProxima.clienteNombre} ({mesaSel.reservaProxima.personas} pax)
            </Aviso>
          )}
          <div>
            <label className="etiqueta">Comensales (capacidad {mesaSel?.capacidad})</label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: Math.max(8, mesaSel?.capacidad ?? 4) }, (_, i) => i + 1).map(
                (n) => (
                  <button
                    key={n}
                    onClick={() => setComensales(n)}
                    className={`h-11 w-11 rounded-lg text-sm font-bold transition ${
                      n === comensales
                        ? 'bg-marca-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
            </div>
          </div>

          {puede('sala.ver') && (
            <div>
              <label className="etiqueta">O cambiar el estado de la mesa</label>
              <div className="flex flex-wrap gap-2">
                {['LIBRE', 'LIMPIEZA', 'RESERVADA', 'FUERA_SERVICIO'].map((e) => (
                  <button
                    key={e}
                    className="boton-secundario"
                    disabled={cambiarEstado.isPending || mesaSel?.estado === e}
                    onClick={() => mesaSel && cambiarEstado.mutate({ id: mesaSel.id, estado: e })}
                  >
                    {ETIQUETA_ESTADO_MESA[e]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function TarjetaMesa({
  mesa,
  onTocar,
  indice,
}: {
  mesa: MesaResumen;
  onTocar: () => void;
  indice?: number;
}) {
  const minutos = mesa.pedido ? minutosDesde(mesa.pedido.abiertoEn) : 0;
  return (
    <button
      onClick={onTocar}
      data-guia={indice === 0 ? 'mesa' : undefined}
      className={`flex min-h-[132px] flex-col items-start gap-1 rounded-xl p-3 text-left ring-2 transition active:scale-[0.98] ${
        COLOR_ESTADO[mesa.estado] ?? 'bg-white ring-slate-300'
      }`}
    >
      <div className="flex w-full items-start justify-between">
        <span className="text-lg font-bold text-slate-900">{mesa.nombre}</span>
        <span className="text-xs text-slate-500">{mesa.capacidad} pax</span>
      </div>

      {mesa.pedido ? (
        <>
          <span className="tabular text-xl font-bold text-slate-900">
            {eur(mesa.pedido.totalCent)}
          </span>
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
            <span>#{mesa.pedido.numero}</span>
            <span>·</span>
            <span>{mesa.pedido.comensales} pax</span>
            <span>·</span>
            <span className={minutos > 90 ? 'font-semibold text-rose-600' : ''}>{minutos} min</span>
          </div>
          {mesa.pedido.lineasPendientes > 0 && (
            <span className="chip bg-rose-100 text-rose-800">
              {mesa.pedido.lineasPendientes} sin enviar
            </span>
          )}
          {mesa.pedido.camarero && (
            <span className="text-[11px] text-slate-500">{mesa.pedido.camarero}</span>
          )}
        </>
      ) : (
        <>
          <Chip estado={mesa.estado} texto={ETIQUETA_ESTADO_MESA[mesa.estado]} />
          {mesa.reservaProxima && (
            <span className="text-[11px] font-medium text-sky-700">
              {hora(mesa.reservaProxima.fecha)} · {mesa.reservaProxima.clienteNombre}
            </span>
          )}
        </>
      )}

      {mesa.juegosEnMesa.length > 0 && (
        <span className="mt-auto truncate text-[11px] text-violet-700">
          🎲 {mesa.juegosEnMesa.map((j) => j.juego).join(', ')}
        </span>
      )}
    </button>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="hidden items-center gap-1.5 text-xs text-slate-600 md:inline-flex">
      <span className={`h-3 w-3 rounded ring-2 ${color}`} />
      {texto}
    </span>
  );
}
