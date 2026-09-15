import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../lib/api';
import { useCanal } from '../lib/socket';
import { dayjs, hora, ETIQUETA_ESTADO_RESERVA } from '../lib/formato';
import type { Juego, Reserva } from '../lib/tipos';
import { Cargando, Chip, Modal, Aviso, Vacio } from '../components/ui';

interface Disponibilidad {
  mesas: {
    id: string;
    nombre: string;
    capacidad: number;
    zona: { id: string; nombre: string };
    disponible: boolean;
    suficiente: boolean;
  }[];
}

export default function Reservas() {
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [dia, setDia] = useState(dayjs().format('YYYY-MM-DD'));
  const [nueva, setNueva] = useState(false);
  const [editar, setEditar] = useState<Reserva | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: reservas, isLoading } = useQuery<Reserva[]>({
    queryKey: ['reservas', dia],
    queryFn: () => api.get(`/reservas?dia=${dia}`),
  });

  const refrescar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['reservas'] });
  }, [qc]);
  useCanal(['reservas'], refrescar);

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      api.post(`/reservas/${id}/estado`, { estado }),
    onSuccess: refrescar,
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'Error'),
  });

  const sentar = useMutation({
    mutationFn: (id: string) =>
      api.post<{ pedidoId: string | null }>(`/reservas/${id}/sentar`, { abrirPedido: true }),
    onSuccess: (r) => {
      refrescar();
      void qc.invalidateQueries({ queryKey: ['sala'] });
      if (r.pedidoId) navegar(`/pedido/${r.pedidoId}`);
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo sentar'),
  });

  const lista = reservas ?? [];
  const personas = lista
    .filter((r) => ['CONFIRMADA', 'PENDIENTE', 'SENTADA'].includes(r.estado))
    .reduce((a, r) => a + r.personas, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button className="boton-suave" onClick={() => setDia(dayjs(dia).subtract(1, 'day').format('YYYY-MM-DD'))}>
            ←
          </button>
          <input
            type="date"
            className="campo w-auto"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          />
          <button className="boton-suave" onClick={() => setDia(dayjs(dia).add(1, 'day').format('YYYY-MM-DD'))}>
            →
          </button>
          <button className="boton-suave" onClick={() => setDia(dayjs().format('YYYY-MM-DD'))}>
            Hoy
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{lista.length}</span> reservas ·{' '}
            <span className="font-bold text-slate-900">{personas}</span> personas
          </span>
          <button className="boton-primario" onClick={() => setNueva(true)}>
            + Nueva reserva
          </button>
        </div>
      </div>

      {error && <div className="px-4 pt-3"><Aviso>{error}</Aviso></div>}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <Vacio
            titulo="Sin reservas este día"
            descripcion="Crea una reserva o cambia de fecha."
            accion={
              <button className="boton-primario mt-2" onClick={() => setNueva(true)}>
                Nueva reserva
              </button>
            }
          />
        ) : (
          <div className="mx-auto max-w-4xl space-y-2">
            {lista.map((r) => (
              <div key={r.id} className="tarjeta flex flex-wrap items-center gap-4 p-3">
                <div className="w-16 shrink-0 text-center">
                  <p className="tabular text-xl font-bold text-slate-900">{hora(r.fecha)}</p>
                  <p className="text-[11px] text-slate-500">{r.duracionMin} min</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {r.clienteNombre}
                    <span className="ml-2 text-sm font-normal text-slate-500">{r.codigo}</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    {r.personas} pax
                    {r.mesas.length > 0 && ` · Mesa ${r.mesas.map((m) => m.nombre).join(', ')}`}
                    {r.telefono && ` · ${r.telefono}`}
                  </p>
                  {r.juegoSolicitado && (
                    <p className="text-[11px] text-violet-700">🎲 Pidió {r.juegoSolicitado.nombre}</p>
                  )}
                  {r.notas && <p className="text-[11px] italic text-slate-500">“{r.notas}”</p>}
                </div>
                <Chip estado={r.estado} texto={ETIQUETA_ESTADO_RESERVA[r.estado]} />
                <div className="flex gap-1.5">
                  {['CONFIRMADA', 'PENDIENTE'].includes(r.estado) && (
                    <>
                      <button
                        className="boton-primario px-3 py-1.5 text-xs"
                        disabled={sentar.isPending}
                        onClick={() => sentar.mutate(r.id)}
                      >
                        Sentar
                      </button>
                      <button
                        className="boton-secundario px-3 py-1.5 text-xs"
                        onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'NO_SHOW' })}
                      >
                        No vino
                      </button>
                    </>
                  )}
                  {r.pedido && (
                    <button
                      className="boton-secundario px-3 py-1.5 text-xs"
                      onClick={() => navegar(`/pedido/${r.pedido!.id}`)}
                    >
                      Ver pedido
                    </button>
                  )}
                  <button
                    className="boton-secundario px-3 py-1.5 text-xs"
                    onClick={() => setEditar(r)}
                  >
                    Editar
                  </button>
                  {!['CANCELADA', 'COMPLETADA'].includes(r.estado) && (
                    <button
                      className="boton-secundario px-3 py-1.5 text-xs text-rose-600"
                      onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'CANCELADA' })}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(nueva || editar) && (
        <FormularioReserva
          reserva={editar}
          diaPorDefecto={dia}
          onCerrar={() => {
            setNueva(false);
            setEditar(null);
          }}
          onGuardado={() => {
            setNueva(false);
            setEditar(null);
            refrescar();
          }}
        />
      )}
    </div>
  );
}

function FormularioReserva({
  reserva,
  diaPorDefecto,
  onCerrar,
  onGuardado,
}: {
  reserva: Reserva | null;
  diaPorDefecto: string;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState({
    clienteNombre: reserva?.clienteNombre ?? '',
    telefono: reserva?.telefono ?? '',
    email: reserva?.email ?? '',
    fechaDia: reserva ? dayjs(reserva.fecha).format('YYYY-MM-DD') : diaPorDefecto,
    fechaHora: reserva ? dayjs(reserva.fecha).format('HH:mm') : '20:00',
    duracionMin: reserva?.duracionMin ?? 120,
    personas: reserva?.personas ?? 2,
    notas: reserva?.notas ?? '',
    origen: reserva?.origen ?? 'TELEFONO',
    juegoSolicitadoId: reserva?.juegoSolicitado?.id ?? '',
  });
  const [mesaIds, setMesaIds] = useState<string[]>(reserva?.mesas.map((m) => m.id) ?? []);
  const [error, setError] = useState<string | null>(null);

  const fechaIso = dayjs(`${form.fechaDia}T${form.fechaHora}`).toISOString();

  const { data: disponibilidad } = useQuery<Disponibilidad>({
    queryKey: ['disponibilidad', fechaIso, form.duracionMin, form.personas, reserva?.id],
    queryFn: () =>
      api.get(
        `/reservas/disponibilidad?fecha=${encodeURIComponent(fechaIso)}&duracionMin=${form.duracionMin}&personas=${form.personas}${reserva ? `&excluirReservaId=${reserva.id}` : ''}`,
      ),
  });

  const { data: juegos } = useQuery<Juego[]>({
    queryKey: ['juegos', 'todos'],
    queryFn: () => api.get('/juegos'),
  });

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = {
        clienteNombre: form.clienteNombre,
        telefono: form.telefono || null,
        email: form.email || null,
        fecha: fechaIso,
        duracionMin: Number(form.duracionMin),
        personas: Number(form.personas),
        notas: form.notas || null,
        origen: form.origen,
        juegoSolicitadoId: form.juegoSolicitadoId || null,
        mesaIds,
      };
      return reserva ? api.patch(`/reservas/${reserva.id}`, cuerpo) : api.post('/reservas', cuerpo);
    },
    onSuccess: onGuardado,
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar'),
  });

  const capacidadElegida = (disponibilidad?.mesas ?? [])
    .filter((m) => mesaIds.includes(m.id))
    .reduce((a, m) => a + m.capacidad, 0);

  return (
    <Modal
      abierto
      titulo={reserva ? `Editar ${reserva.codigo}` : 'Nueva reserva'}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      pie={
        <>
          <button className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="boton-primario"
            disabled={!form.clienteNombre.trim() || guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Aviso>{error}</Aviso>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta">Nombre del cliente</label>
            <input
              className="campo"
              value={form.clienteNombre}
              onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="etiqueta">Teléfono</label>
            <input
              className="campo"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              inputMode="tel"
            />
          </div>
          <div>
            <label className="etiqueta">Email</label>
            <input
              className="campo"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="etiqueta">Día</label>
            <input
              className="campo"
              type="date"
              value={form.fechaDia}
              onChange={(e) => setForm({ ...form, fechaDia: e.target.value })}
            />
          </div>
          <div>
            <label className="etiqueta">Hora</label>
            <input
              className="campo"
              type="time"
              value={form.fechaHora}
              onChange={(e) => setForm({ ...form, fechaHora: e.target.value })}
            />
          </div>
          <div>
            <label className="etiqueta">Personas</label>
            <input
              className="campo tabular"
              type="number"
              min={1}
              value={form.personas}
              onChange={(e) => setForm({ ...form, personas: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="etiqueta">Duración</label>
            <select
              className="campo"
              value={form.duracionMin}
              onChange={(e) => setForm({ ...form, duracionMin: Number(e.target.value) })}
            >
              {[60, 90, 120, 150, 180, 240].map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta">Origen</label>
            <select
              className="campo"
              value={form.origen}
              onChange={(e) => setForm({ ...form, origen: e.target.value })}
            >
              <option value="TELEFONO">Teléfono</option>
              <option value="LOCAL">En el local</option>
              <option value="WEB">Web</option>
            </select>
          </div>
          <div>
            <label className="etiqueta">Juego reservado (opcional)</label>
            <select
              className="campo"
              value={form.juegoSolicitadoId}
              onChange={(e) => setForm({ ...form, juegoSolicitadoId: e.target.value })}
            >
              <option value="">Ninguno</option>
              {(juegos ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta">Notas</label>
            <input
              className="campo"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Cumpleaños, trona, alergias…"
            />
          </div>
        </div>

        <div>
          <label className="etiqueta">
            Mesas · elegidas para {capacidadElegida} de {form.personas} personas
          </label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {(disponibilidad?.mesas ?? []).map((m) => {
              const elegida = mesaIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  disabled={!m.disponible && !elegida}
                  onClick={() =>
                    setMesaIds((s) => (elegida ? s.filter((x) => x !== m.id) : [...s, m.id]))
                  }
                  className={`rounded-lg p-2 text-center text-sm transition ${
                    elegida
                      ? 'bg-marca-600 text-white'
                      : m.disponible
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'cursor-not-allowed bg-rose-50 text-rose-300'
                  }`}
                  title={m.disponible ? m.zona.nombre : 'Ocupada a esa hora'}
                >
                  <span className="block font-bold">{m.nombre}</span>
                  <span className="block text-[10px] opacity-75">{m.capacidad} pax</span>
                </button>
              );
            })}
          </div>
          {capacidadElegida > 0 && capacidadElegida < form.personas && (
            <p className="mt-1.5 text-xs text-amber-700">
              Las mesas elegidas no cubren a todas las personas. Puedes añadir otra o unirlas en sala.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
