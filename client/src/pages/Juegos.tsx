import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { minutosDesde } from '../lib/formato';
import type { Juego } from '../lib/tipos';
import { Cargando, Chip, Modal, Aviso, Vacio } from '../components/ui';

const CATEGORIAS = ['FAMILIAR', 'ESTRATEGIA', 'PARTY', 'CARTAS', 'ROL', 'INFANTIL'];
const COMPLEJIDAD = ['', 'Muy sencillo', 'Sencillo', 'Medio', 'Exigente', 'Muy exigente'];

export default function Juegos() {
  const qc = useQueryClient();
  const puede = useSesion((s) => s.puede);
  const [texto, setTexto] = useState('');
  const [jugadores, setJugadores] = useState<number | null>(null);
  const [maxDuracion, setMaxDuracion] = useState<number | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [editar, setEditar] = useState<Juego | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parametros = new URLSearchParams();
  if (texto) parametros.set('texto', texto);
  if (jugadores) parametros.set('jugadores', String(jugadores));
  if (maxDuracion) parametros.set('maxDuracion', String(maxDuracion));
  if (categoria) parametros.set('categoria', categoria);

  const { data: juegos, isLoading } = useQuery<Juego[]>({
    queryKey: ['juegos', parametros.toString()],
    queryFn: () => api.get(`/juegos?${parametros.toString()}`),
  });

  const refrescar = () => void qc.invalidateQueries({ queryKey: ['juegos'] });

  const devolver = useMutation({
    mutationFn: (prestamoId: string) => api.post(`/juegos/prestamos/${prestamoId}/devolver`, {}),
    onSuccess: refrescar,
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'Error'),
  });

  const lista = juegos ?? [];
  const prestados = lista.filter((j) => j.estado === 'PRESTADO').length;

  return (
    <div className="flex h-full flex-col">
      <div data-guia="juegos-filtros" className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <input
          className="campo max-w-xs"
          placeholder="Buscar juego…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <select
          className="campo w-auto"
          value={jugadores ?? ''}
          onChange={(e) => setJugadores(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Cualquier nº de jugadores</option>
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              Para {n} jugadores
            </option>
          ))}
        </select>
        <select
          className="campo w-auto"
          value={maxDuracion ?? ''}
          onChange={(e) => setMaxDuracion(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Cualquier duración</option>
          {[20, 30, 45, 60, 90, 120].map((n) => (
            <option key={n} value={n}>
              Hasta {n} min
            </option>
          ))}
        </select>
        <select
          className="campo w-auto"
          value={categoria ?? ''}
          onChange={(e) => setCategoria(e.target.value || null)}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-slate-600">
          <span className="font-bold text-slate-900">{lista.length}</span> juegos ·{' '}
          <span className="font-bold text-amber-700">{prestados}</span> en mesas
        </span>
        {puede('juegos.gestionar') && (
          <button className="boton-primario" onClick={() => setNuevo(true)}>
            + Añadir juego
          </button>
        )}
      </div>

      {error && <div className="px-4 pt-3"><Aviso>{error}</Aviso></div>}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <Vacio titulo="Ningún juego coincide" descripcion="Prueba a quitar algún filtro." />
        ) : (
          <div data-guia="juegos-lista" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {lista.map((j) => (
              <div key={j.id} className="tarjeta flex flex-col p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold leading-tight text-slate-900">{j.nombre}</h3>
                  <Chip estado={j.estado} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {j.minJugadores}–{j.maxJugadores} jugadores · {j.duracionMin} min
                </p>
                <p className="text-[11px] text-slate-500">
                  {COMPLEJIDAD[j.complejidad]}
                  {j.categoria && ` · ${j.categoria.charAt(0)}${j.categoria.slice(1).toLowerCase()}`}
                  {j.ubicacion && ` · Estante ${j.ubicacion}`}
                </p>
                {j.prestamoActivo && (
                  <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    En {j.prestamoActivo.mesa?.nombre ?? 'una mesa'} desde hace{' '}
                    {minutosDesde(j.prestamoActivo.inicioEn)} min
                  </p>
                )}
                {puede('juegos.gestionar') && (
                  <div className="mt-auto flex gap-1.5 pt-2">
                    {j.prestamoActivo ? (
                      <button
                        className="boton-primario flex-1 px-2 py-1.5 text-xs"
                        onClick={() => devolver.mutate(j.prestamoActivo!.id)}
                      >
                        Devolver
                      </button>
                    ) : (
                      <span className="flex-1 text-[11px] text-slate-400">
                        Se presta desde el pedido de la mesa
                      </span>
                    )}
                    <button
                      className="boton-secundario px-2 py-1.5 text-xs"
                      onClick={() => setEditar(j)}
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {(nuevo || editar) && (
        <FormularioJuego
          juego={editar}
          onCerrar={() => {
            setNuevo(false);
            setEditar(null);
          }}
          onGuardado={() => {
            setNuevo(false);
            setEditar(null);
            refrescar();
          }}
        />
      )}
    </div>
  );
}

function FormularioJuego({
  juego,
  onCerrar,
  onGuardado,
}: {
  juego: Juego | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState({
    nombre: juego?.nombre ?? '',
    descripcion: juego?.descripcion ?? '',
    minJugadores: juego?.minJugadores ?? 2,
    maxJugadores: juego?.maxJugadores ?? 4,
    duracionMin: juego?.duracionMin ?? 45,
    complejidad: juego?.complejidad ?? 2,
    categoria: juego?.categoria ?? 'FAMILIAR',
    ubicacion: juego?.ubicacion ?? '',
    estado: juego?.estado ?? 'DISPONIBLE',
    notas: juego?.notas ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = {
        ...form,
        minJugadores: Number(form.minJugadores),
        maxJugadores: Number(form.maxJugadores),
        duracionMin: Number(form.duracionMin),
        complejidad: Number(form.complejidad),
        descripcion: form.descripcion || null,
        ubicacion: form.ubicacion || null,
        notas: form.notas || null,
      };
      return juego ? api.patch(`/juegos/${juego.id}`, cuerpo) : api.post('/juegos', cuerpo);
    },
    onSuccess: onGuardado,
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar'),
  });

  return (
    <Modal
      abierto
      titulo={juego ? 'Editar juego' : 'Añadir juego a la ludoteca'}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="boton-primario"
            disabled={!form.nombre.trim() || guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Aviso>{error}</Aviso>}
        <div>
          <label className="etiqueta">Nombre</label>
          <input
            className="campo"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="etiqueta">Mín. jugadores</label>
            <input
              className="campo tabular"
              type="number"
              min={1}
              value={form.minJugadores}
              onChange={(e) => setForm({ ...form, minJugadores: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="etiqueta">Máx. jugadores</label>
            <input
              className="campo tabular"
              type="number"
              min={1}
              value={form.maxJugadores}
              onChange={(e) => setForm({ ...form, maxJugadores: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="etiqueta">Duración (min)</label>
            <input
              className="campo tabular"
              type="number"
              min={5}
              value={form.duracionMin}
              onChange={(e) => setForm({ ...form, duracionMin: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="etiqueta">Complejidad</label>
            <select
              className="campo"
              value={form.complejidad}
              onChange={(e) => setForm({ ...form, complejidad: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} · {COMPLEJIDAD[n]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta">Categoría</label>
            <select
              className="campo"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta">Estante</label>
            <input
              className="campo"
              value={form.ubicacion}
              onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
              placeholder="A1"
            />
          </div>
        </div>
        <div>
          <label className="etiqueta">Estado</label>
          <select
            className="campo"
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
          >
            {['DISPONIBLE', 'MANTENIMIENTO', 'PERDIDO'].map((e) => (
              <option key={e} value={e}>
                {e.charAt(0) + e.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta">Notas</label>
          <input
            className="campo"
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            placeholder="Falta una ficha, caja reparada…"
          />
        </div>
      </div>
    </Modal>
  );
}
