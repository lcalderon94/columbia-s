import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../lib/api';
import { useCanal } from '../lib/socket';
import { useSesion } from '../lib/sesion';
import { eur, aCentimos } from '../lib/formato';
import type { Categoria, Juego, Pedido as TipoPedido, Producto } from '../lib/tipos';
import { Cargando, Chip, Modal, Aviso, TecladoNumerico } from '../components/ui';

interface ModSeleccionado {
  nombre: string;
  precioCent: number;
}

export default function Pedido() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();
  const puede = useSesion((s) => s.puede);

  const [catActiva, setCatActiva] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [productoMods, setProductoMods] = useState<Producto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<
    null | 'descuento' | 'cover' | 'juego' | 'mover' | 'dividir' | 'libre' | 'anular'
  >(null);

  const { data: pedido, isLoading } = useQuery<TipoPedido>({
    queryKey: ['pedido', id],
    queryFn: () => api.get(`/pedidos/${id}`),
  });
  const { data: carta } = useQuery<Categoria[]>({
    queryKey: ['carta'],
    queryFn: () => api.get('/carta'),
    staleTime: 5 * 60_000,
  });

  const refrescar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['pedido', id] });
  }, [qc, id]);
  useCanal(['sala'], refrescar);

  const alFallar = (e: unknown) =>
    setError(e instanceof ErrorApi ? e.message : 'Ha ocurrido un error');

  const tras = () => {
    setError(null);
    refrescar();
    void qc.invalidateQueries({ queryKey: ['sala'] });
  };

  const anadirLineas = useMutation({
    mutationFn: (lineas: unknown[]) => api.post(`/pedidos/${id}/lineas`, { lineas }),
    onSuccess: tras,
    onError: alFallar,
  });
  const cambiarLinea = useMutation({
    mutationFn: ({ lineaId, datos }: { lineaId: string; datos: unknown }) =>
      api.patch(`/pedidos/${id}/lineas/${lineaId}`, datos),
    onSuccess: tras,
    onError: alFallar,
  });
  const quitarLinea = useMutation({
    mutationFn: ({ lineaId, motivo }: { lineaId: string; motivo?: string }) =>
      api.del(`/pedidos/${id}/lineas/${lineaId}`, { motivo }),
    onSuccess: tras,
    onError: alFallar,
  });
  const enviar = useMutation({
    mutationFn: () => api.post(`/pedidos/${id}/enviar`),
    onSuccess: tras,
    onError: alFallar,
  });
  const cambiarPedido = useMutation({
    mutationFn: (datos: unknown) => api.patch(`/pedidos/${id}`, datos),
    onSuccess: tras,
    onError: alFallar,
  });

  const categorias = carta ?? [];
  const categoria = categorias.find((c) => c.id === catActiva) ?? categorias[0];

  const resultados = useMemo(() => {
    if (!busqueda.trim()) return null;
    const t = busqueda.toLowerCase();
    return categorias
      .flatMap((c) => c.productos)
      .filter((p) => p.nombre.toLowerCase().includes(t))
      .slice(0, 40);
  }, [busqueda, categorias]);

  if (isLoading || !pedido) return <Cargando texto="Cargando pedido…" />;

  const cerrado = pedido.estado === 'COBRADO' || pedido.estado === 'ANULADO';
  const pendientes = pedido.lineas.filter((l) => l.estado === 'PENDIENTE');
  const visibles = pedido.lineas.filter((l) => l.estado !== 'ANULADO');

  const anadirProducto = (p: Producto) => {
    if (cerrado) return;
    if (p.gruposModificador.length > 0) {
      setProductoMods(p);
      return;
    }
    anadirLineas.mutate([{ productoId: p.id, cantidad: 1 }]);
  };

  return (
    <div className="flex h-full">
      {/* -- Carta ----------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <input
            data-guia="buscador"
            className="campo max-w-xs"
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="boton-suave" onClick={() => setBusqueda('')}>
              Limpiar
            </button>
          )}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <button
              data-guia="cover"
              className="boton-secundario"
              onClick={() => setDialogo('cover')}
              disabled={cerrado}
            >
              🎲 Cover
            </button>
            <button
              data-guia="juego"
              className="boton-secundario"
              onClick={() => setDialogo('juego')}
              disabled={cerrado}
            >
              Prestar juego
            </button>
            <button className="boton-secundario" onClick={() => setDialogo('libre')} disabled={cerrado}>
              Línea libre
            </button>
          </div>
        </div>

        {!resultados && (
          <div data-guia="categorias" className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-white px-3 py-2">
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatActiva(c.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  c.id === categoria?.id
                    ? 'text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={c.id === categoria?.id ? { backgroundColor: c.color } : undefined}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-slate-50 p-3">
          <div data-guia="productos" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {(resultados ?? categoria?.productos ?? []).map((p) => (
              <BotonProducto key={p.id} producto={p} onTocar={() => anadirProducto(p)} disabled={cerrado} />
            ))}
          </div>
        </div>
      </div>

      {/* -- Comanda --------------------------------------------------- */}
      <div className="flex w-[380px] shrink-0 flex-col bg-white 2xl:w-[440px]">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-slate-900">
                {pedido.mesa ? `Mesa ${pedido.mesa.nombre}` : pedido.tipo}
              </p>
              <p className="text-xs text-slate-500">
                Pedido #{pedido.numero} · {pedido.comensales} pax
                {pedido.camarero && ` · ${pedido.camarero.nombre}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Chip estado={pedido.estado} />
              {pedido.esPractica && (
                <span className="chip bg-violet-100 text-violet-800">Prácticas</span>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className="boton-suave px-2 py-1 text-xs" onClick={() => navegar('/sala')}>
              ← Sala
            </button>
            <button
              className="boton-suave px-2 py-1 text-xs"
              disabled={cerrado}
              onClick={() => {
                const n = prompt('Número de comensales', String(pedido.comensales));
                if (n) cambiarPedido.mutate({ comensales: Number(n) });
              }}
            >
              Comensales
            </button>
            {puede('pedidos.transferir') && (
              <>
                <button className="boton-suave px-2 py-1 text-xs" disabled={cerrado} onClick={() => setDialogo('mover')}>
                  Mover
                </button>
                <button className="boton-suave px-2 py-1 text-xs" disabled={cerrado} onClick={() => setDialogo('dividir')}>
                  Dividir
                </button>
              </>
            )}
            {puede('pedidos.descuento') && (
              <button className="boton-suave px-2 py-1 text-xs" disabled={cerrado} onClick={() => setDialogo('descuento')}>
                Descuento
              </button>
            )}
          </div>
        </div>

        {error && <div className="px-4 pt-3"><Aviso>{error}</Aviso></div>}

        <div data-guia="comanda" className="flex-1 overflow-y-auto px-2 py-2">
          {visibles.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              Toca los productos de la carta para añadirlos.
            </p>
          ) : (
            <ul className="space-y-1">
              {visibles.map((l) => (
                <li
                  key={l.id}
                  className={`rounded-lg px-2 py-2 ${
                    l.estado === 'PENDIENTE' ? 'bg-amber-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="tabular mt-0.5 w-6 text-center text-sm font-bold text-slate-700">
                      {l.cantidad}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{l.nombre}</p>
                      {l.modificadores.map((m, i) => (
                        <p key={i} className="text-[11px] text-slate-500">
                          + {m.nombre}
                          {m.precioCent > 0 && ` (${eur(m.precioCent)})`}
                        </p>
                      ))}
                      {l.notas && <p className="text-[11px] italic text-sky-700">“{l.notas}”</p>}
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Chip estado={l.estado} />
                        {l.invitada && <span className="chip bg-violet-100 text-violet-800">Invitada</span>}
                        {l.descuentoValor > 0 && (
                          <span className="chip bg-amber-100 text-amber-800">
                            -{l.descuentoTipo === 'PORCENTAJE' ? `${l.descuentoValor}%` : eur(l.descuentoValor)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`tabular text-sm font-semibold ${l.invitada ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {eur(l.brutoCent)}
                      </p>
                      {!cerrado && (
                        <div className="mt-1 flex gap-1">
                          <BotonMini
                            texto="−"
                            onTocar={() =>
                              l.cantidad > 1
                                ? cambiarLinea.mutate({ lineaId: l.id, datos: { cantidad: l.cantidad - 1 } })
                                : quitarLinea.mutate({ lineaId: l.id, motivo: 'Retirada por el camarero' })
                            }
                          />
                          <BotonMini
                            texto="+"
                            onTocar={() => cambiarLinea.mutate({ lineaId: l.id, datos: { cantidad: l.cantidad + 1 } })}
                          />
                          <BotonMini
                            texto="⋯"
                            onTocar={() => {
                              const nota = prompt('Nota para cocina', l.notas ?? '');
                              if (nota !== null) cambiarLinea.mutate({ lineaId: l.id, datos: { notas: nota } });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-3">
          <Totales pedido={pedido} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              data-guia="enviar"
              className="boton-secundario"
              disabled={pendientes.length === 0 || enviar.isPending || cerrado}
              onClick={() => enviar.mutate()}
            >
              {enviar.isPending ? 'Enviando…' : `Enviar${pendientes.length ? ` (${pendientes.length})` : ''}`}
            </button>
            <button
              className="boton-primario"
              disabled={visibles.length === 0 || cerrado || !puede('cobro.realizar')}
              onClick={() => navegar(`/cobro/${id}`)}
            >
              Cobrar {eur(pedido.totales.totalCent)}
            </button>
          </div>
          {cerrado && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Pedido {pedido.estado.toLowerCase()}
              {pedido.facturas[0] && ` · Factura ${pedido.facturas[0].codigo}`}
            </p>
          )}
        </div>
      </div>

      {productoMods && (
        <DialogoModificadores
          producto={productoMods}
          onCerrar={() => setProductoMods(null)}
          onConfirmar={(cantidad, mods, notas) => {
            anadirLineas.mutate([
              { productoId: productoMods.id, cantidad, modificadores: mods, notas: notas || null },
            ]);
            setProductoMods(null);
          }}
        />
      )}

      <DialogoCover
        abierto={dialogo === 'cover'}
        comensales={pedido.comensales}
        onCerrar={() => setDialogo(null)}
        onConfirmar={(modalidad, personas) => {
          api.post(`/pedidos/${id}/cover`, { modalidad, personas }).then(tras).catch(alFallar);
          setDialogo(null);
        }}
      />

      <DialogoDescuento
        abierto={dialogo === 'descuento'}
        pedido={pedido}
        onCerrar={() => setDialogo(null)}
        onConfirmar={(datos) => {
          api.post(`/pedidos/${id}/descuento`, datos).then(tras).catch(alFallar);
          setDialogo(null);
        }}
      />

      <DialogoJuego
        abierto={dialogo === 'juego'}
        pedidoId={id}
        mesaId={pedido.mesa?.id ?? null}
        prestados={pedido.juegos}
        onCerrar={() => setDialogo(null)}
        onHecho={tras}
      />

      <DialogoLineaLibre
        abierto={dialogo === 'libre'}
        onCerrar={() => setDialogo(null)}
        onConfirmar={(linea) => {
          anadirLineas.mutate([linea]);
          setDialogo(null);
        }}
      />

      <DialogoMover
        abierto={dialogo === 'mover'}
        pedidoId={id}
        onCerrar={() => setDialogo(null)}
        onHecho={tras}
      />

      <DialogoDividir
        abierto={dialogo === 'dividir'}
        pedido={pedido}
        onCerrar={() => setDialogo(null)}
        onHecho={(nuevoId) => {
          tras();
          setDialogo(null);
          if (nuevoId) navegar(`/pedido/${nuevoId}`);
        }}
      />
    </div>
  );
}

function BotonMini({ texto, onTocar }: { texto: string; onTocar: () => void }) {
  return (
    <button
      onClick={onTocar}
      className="h-7 w-7 rounded bg-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-300 active:scale-90"
    >
      {texto}
    </button>
  );
}

function BotonProducto({
  producto,
  onTocar,
  disabled,
}: {
  producto: Producto;
  onTocar: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onTocar}
      disabled={disabled}
      className="flex min-h-[86px] flex-col justify-between rounded-lg bg-white p-2.5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-marca-500 active:scale-[0.97] disabled:opacity-50"
    >
      <span className="text-sm font-semibold leading-tight text-slate-900">{producto.nombre}</span>
      <span className="mt-1 flex items-center justify-between">
        <span className="tabular text-sm font-bold text-marca-700">{eur(producto.precioCent)}</span>
        <span className="flex gap-0.5 text-xs">
          {producto.vegano && <span title="Vegano">🌱</span>}
          {producto.picante && <span title="Picante">🌶️</span>}
          {producto.kids && <span title="Para niños">🧒</span>}
        </span>
      </span>
    </button>
  );
}

function Totales({ pedido }: { pedido: TipoPedido }) {
  const t = pedido.totales;
  return (
    <div className="space-y-1 text-sm">
      {t.descuentoTotalCent > 0 && (
        <>
          <Fila texto="Subtotal" valor={eur(t.brutoCent)} />
          <Fila texto="Descuento" valor={`-${eur(t.descuentoTotalCent)}`} tono="text-amber-700" />
        </>
      )}
      {t.invitadoCent > 0 && (
        <Fila texto="Invitaciones" valor={`-${eur(t.invitadoCent)}`} tono="text-violet-700" />
      )}
      <div className="flex justify-between border-t border-slate-200 pt-1.5">
        <span className="text-base font-bold text-slate-900">Total</span>
        <span className="tabular text-xl font-bold text-slate-900">{eur(t.totalCent)}</span>
      </div>
      {t.desglose.length > 0 && (
        <p className="text-[11px] text-slate-500">
          Base {eur(t.baseCent)} · IVA {eur(t.cuotaCent)} (
          {t.desglose.map((d) => `${d.ivaTipo}%`).join(', ')})
        </p>
      )}
      {t.cobradoCent > 0 && t.pendienteCent > 0 && (
        <Fila texto="Pendiente" valor={eur(t.pendienteCent)} tono="font-bold text-rose-600" />
      )}
    </div>
  );
}

function Fila({ texto, valor, tono = 'text-slate-600' }: { texto: string; valor: string; tono?: string }) {
  return (
    <div className="flex justify-between">
      <span className={tono}>{texto}</span>
      <span className={`tabular ${tono}`}>{valor}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

function DialogoModificadores({
  producto,
  onCerrar,
  onConfirmar,
}: {
  producto: Producto;
  onCerrar: () => void;
  onConfirmar: (cantidad: number, mods: ModSeleccionado[], notas: string) => void;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>({});
  const [notas, setNotas] = useState('');

  const alternar = (grupoId: string, modId: string, max: number) => {
    setSeleccion((s) => {
      const actual = s[grupoId] ?? [];
      if (actual.includes(modId)) return { ...s, [grupoId]: actual.filter((x) => x !== modId) };
      // Si el grupo es de elección única, el nuevo sustituye al anterior
      if (max === 1) return { ...s, [grupoId]: [modId] };
      if (actual.length >= max) return s;
      return { ...s, [grupoId]: [...actual, modId] };
    });
  };

  const elegidos: ModSeleccionado[] = producto.gruposModificador.flatMap((g) =>
    (seleccion[g.id] ?? [])
      .map((mid) => g.modificadores.find((m) => m.id === mid))
      .filter(Boolean)
      .map((m) => ({ nombre: m!.nombre, precioCent: m!.precioCent })),
  );

  const faltanObligatorios = producto.gruposModificador.filter(
    (g) => g.min > 0 && (seleccion[g.id] ?? []).length < g.min,
  );
  const extraCent = elegidos.reduce((a, m) => a + m.precioCent, 0);

  return (
    <Modal
      abierto
      titulo={producto.nombre}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="boton-primario"
            disabled={faltanObligatorios.length > 0}
            onClick={() => onConfirmar(cantidad, elegidos, notas)}
          >
            Añadir · {eur((producto.precioCent + extraCent) * cantidad)}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {producto.descripcion && <p className="text-sm text-slate-600">{producto.descripcion}</p>}
        {producto.alergenos.length > 0 && (
          <p className="text-xs text-slate-500">
            <span className="font-semibold">Alérgenos:</span>{' '}
            {producto.alergenos.map((a) => a.nombre).join(', ')}
          </p>
        )}

        <div>
          <label className="etiqueta">Cantidad</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setCantidad(n)}
                className={`h-11 w-11 rounded-lg font-bold transition ${
                  n === cantidad ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {producto.gruposModificador.map((g) => (
          <div key={g.id}>
            <label className="etiqueta">
              {g.nombre}
              {g.min > 0 && <span className="ml-1 text-rose-600">obligatorio</span>}
              {g.max > 1 && <span className="ml-1 normal-case text-slate-400">(máx. {g.max})</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {g.modificadores.map((m) => {
                const activo = (seleccion[g.id] ?? []).includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => alternar(g.id, m.id, g.max)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      activo
                        ? 'bg-marca-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {m.nombre}
                    {m.precioCent > 0 && (
                      <span className="ml-1 opacity-75">+{eur(m.precioCent)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <label className="etiqueta">Nota para cocina</label>
          <input
            className="campo"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej.: alergia al huevo, salsa aparte…"
          />
        </div>
      </div>
    </Modal>
  );
}

function DialogoCover({
  abierto,
  comensales,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  comensales: number;
  onCerrar: () => void;
  onConfirmar: (modalidad: 'CONSUMIENDO' | 'SOLO_JUGAR', personas: number) => void;
}) {
  const [personas, setPersonas] = useState(comensales);
  return (
    <Modal abierto={abierto} titulo="Cover de ludoteca" onCerrar={onCerrar}>
      <div className="space-y-4">
        <div>
          <label className="etiqueta">Personas</label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPersonas(n)}
                className={`h-11 w-11 rounded-lg font-bold transition ${
                  n === personas ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            className="rounded-xl bg-marca-600 p-4 text-left text-white transition hover:bg-marca-700"
            onClick={() => onConfirmar('CONSUMIENDO', personas)}
          >
            <p className="text-sm font-semibold">Consumiendo</p>
            <p className="text-2xl font-bold">{eur(400 * personas)}</p>
            <p className="text-xs opacity-80">4 € por persona</p>
          </button>
          <button
            className="rounded-xl bg-violet-600 p-4 text-left text-white transition hover:bg-violet-700"
            onClick={() => onConfirmar('SOLO_JUGAR', personas)}
          >
            <p className="text-sm font-semibold">Solo jugar</p>
            <p className="text-2xl font-bold">{eur(700 * personas)}</p>
            <p className="text-xs opacity-80">7 € por persona</p>
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DialogoDescuento({
  abierto,
  pedido,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  pedido: TipoPedido;
  onCerrar: () => void;
  onConfirmar: (datos: { tipo: string | null; valor: number; motivo: string }) => void;
}) {
  const [tipo, setTipo] = useState<'PORCENTAJE' | 'IMPORTE'>('PORCENTAJE');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');

  const valorNum = tipo === 'PORCENTAJE' ? Number(valor || 0) : aCentimos(valor);

  return (
    <Modal
      abierto={abierto}
      titulo="Descuento del pedido"
      onCerrar={onCerrar}
      pie={
        <>
          <button
            className="boton-secundario"
            onClick={() => onConfirmar({ tipo: null, valor: 0, motivo: '' })}
          >
            Quitar descuento
          </button>
          <button
            className="boton-primario"
            disabled={!valorNum || !motivo.trim()}
            onClick={() => onConfirmar({ tipo, valor: valorNum, motivo })}
          >
            Aplicar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['PORCENTAJE', 'IMPORTE'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                t === tipo ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {t === 'PORCENTAJE' ? 'Porcentaje %' : 'Importe €'}
            </button>
          ))}
        </div>
        <div>
          <label className="etiqueta">{tipo === 'PORCENTAJE' ? 'Porcentaje' : 'Importe en euros'}</label>
          <input
            className="campo"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={tipo === 'PORCENTAJE' ? '10' : '5,00'}
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="etiqueta">Motivo (queda registrado)</label>
          <input
            className="campo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: incidencia en el servicio"
          />
        </div>
        <p className="text-sm text-slate-500">
          Total actual: <span className="tabular font-semibold">{eur(pedido.totales.totalCent)}</span>
        </p>
      </div>
    </Modal>
  );
}

function DialogoJuego({
  abierto,
  pedidoId,
  mesaId,
  prestados,
  onCerrar,
  onHecho,
}: {
  abierto: boolean;
  pedidoId: string;
  mesaId: string | null;
  prestados: TipoPedido['juegos'];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const { data: juegos } = useQuery<Juego[]>({
    queryKey: ['juegos', 'DISPONIBLE'],
    queryFn: () => api.get('/juegos?estado=DISPONIBLE'),
    enabled: abierto,
  });

  const filtrados = (juegos ?? []).filter((j) =>
    j.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <Modal abierto={abierto} titulo="Juegos en la mesa" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        {prestados.length > 0 && (
          <div>
            <p className="etiqueta">En la mesa ahora</p>
            <div className="flex flex-wrap gap-2">
              {prestados.map((j) => (
                <button
                  key={j.prestamoId}
                  className="boton-secundario"
                  onClick={() =>
                    api.post(`/juegos/prestamos/${j.prestamoId}/devolver`, {}).then(onHecho)
                  }
                >
                  🎲 {j.nombre} · devolver
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          className="campo"
          placeholder="Buscar juego…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {filtrados.map((j) => (
            <button
              key={j.id}
              className="rounded-lg bg-slate-50 p-2.5 text-left ring-1 ring-slate-200 transition hover:ring-marca-500"
              onClick={() =>
                api.post(`/juegos/${j.id}/prestar`, { pedidoId, mesaId }).then(onHecho)
              }
            >
              <p className="text-sm font-semibold text-slate-900">{j.nombre}</p>
              <p className="text-[11px] text-slate-500">
                {j.minJugadores}–{j.maxJugadores} jug · {j.duracionMin} min
              </p>
              {j.ubicacion && <p className="text-[11px] text-violet-700">Estante {j.ubicacion}</p>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function DialogoLineaLibre({
  abierto,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: (linea: unknown) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [iva, setIva] = useState(10);
  return (
    <Modal
      abierto={abierto}
      titulo="Línea libre"
      onCerrar={onCerrar}
      pie={
        <button
          className="boton-primario"
          disabled={!nombre.trim() || !aCentimos(precio)}
          onClick={() => {
            onConfirmar({ nombre, precioUnitCent: aCentimos(precio), ivaTipo: iva, cantidad: 1 });
            setNombre('');
            setPrecio('');
          }}
        >
          Añadir
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Para cobrar algo que no está en la carta (un evento, un producto puntual).
        </p>
        <div>
          <label className="etiqueta">Concepto</label>
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiqueta">Precio</label>
            <input
              className="campo"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="etiqueta">IVA</label>
            <select className="campo" value={iva} onChange={(e) => setIva(Number(e.target.value))}>
              {[0, 4, 10, 21].map((v) => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DialogoMover({
  abierto,
  pedidoId,
  onCerrar,
  onHecho,
}: {
  abierto: boolean;
  pedidoId: string;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const { data: sala } = useQuery<{ zonas: { id: string; nombre: string; mesas: any[] }[] }>({
    queryKey: ['sala'],
    queryFn: () => api.get('/sala'),
    enabled: abierto,
  });
  const [error, setError] = useState<string | null>(null);

  const libres = (sala?.zonas ?? []).flatMap((z) =>
    z.mesas.filter((m: any) => !m.pedido && m.estado !== 'FUERA_SERVICIO').map((m: any) => ({ ...m, zona: z.nombre })),
  );

  return (
    <Modal abierto={abierto} titulo="Mover el pedido a otra mesa" onCerrar={onCerrar}>
      {error && <div className="mb-3"><Aviso>{error}</Aviso></div>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {libres.map((m: any) => (
          <button
            key={m.id}
            className="rounded-lg bg-slate-50 p-3 text-center ring-1 ring-slate-200 transition hover:ring-marca-500"
            onClick={() =>
              api
                .post(`/pedidos/${pedidoId}/mover`, { mesaId: m.id })
                .then(() => {
                  onHecho();
                  onCerrar();
                })
                .catch((e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo mover'))
            }
          >
            <p className="font-bold text-slate-900">{m.nombre}</p>
            <p className="text-[11px] text-slate-500">{m.zona}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function DialogoDividir({
  abierto,
  pedido,
  onCerrar,
  onHecho,
}: {
  abierto: boolean;
  pedido: TipoPedido;
  onCerrar: () => void;
  onHecho: (nuevoId?: string) => void;
}) {
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const visibles = pedido.lineas.filter((l) => l.estado !== 'ANULADO');
  const totalElegido = visibles
    .filter((l) => elegidas.includes(l.id))
    .reduce((a, l) => a + l.totalCent, 0);

  return (
    <Modal
      abierto={abierto}
      titulo="Dividir la cuenta"
      onCerrar={onCerrar}
      ancho="max-w-xl"
      pie={
        <button
          className="boton-primario"
          disabled={elegidas.length === 0 || elegidas.length === visibles.length}
          onClick={() =>
            api
              .post<{ destino: { id: string } }>(`/pedidos/${pedido.id}/dividir`, {
                lineaIds: elegidas,
              })
              .then((r) => onHecho(r.destino.id))
              .catch((e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo dividir'))
          }
        >
          Separar {elegidas.length} líneas · {eur(totalElegido)}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Marca lo que se lleva a una cuenta aparte. Se creará un pedido nuevo con esas líneas.
        </p>
        {error && <Aviso>{error}</Aviso>}
        <ul className="divide-y divide-slate-100">
          {visibles.map((l) => (
            <li key={l.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-marca-600 focus:ring-marca-500"
                  checked={elegidas.includes(l.id)}
                  onChange={(e) =>
                    setElegidas((s) =>
                      e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id),
                    )
                  }
                />
                <span className="tabular w-6 text-sm font-bold text-slate-600">{l.cantidad}</span>
                <span className="flex-1 text-sm text-slate-800">{l.nombre}</span>
                <span className="tabular text-sm font-semibold">{eur(l.totalCent)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
