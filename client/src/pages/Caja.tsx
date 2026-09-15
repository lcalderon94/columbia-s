import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../lib/api';
import { useCanal } from '../lib/socket';
import { useSesion } from '../lib/sesion';
import { eur, aCentimos, fechaHora, hora, ETIQUETA_METODO } from '../lib/formato';
import type { SesionCaja } from '../lib/tipos';
import { Cargando, Modal, Aviso, Vacio } from '../components/ui';

const DENOMINACIONES = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export default function Caja() {
  const qc = useQueryClient();
  const puede = useSesion((s) => s.puede);
  const [dialogo, setDialogo] = useState<null | 'abrir' | 'cerrar' | 'movimiento'>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: caja, isLoading } = useQuery<SesionCaja | null>({
    queryKey: ['caja'],
    queryFn: () => api.get('/caja/actual'),
    refetchInterval: 60_000,
  });

  const { data: sesiones } = useQuery<any[]>({
    queryKey: ['caja', 'sesiones'],
    queryFn: () => api.get('/caja/sesiones?limite=15'),
  });

  const refrescar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['caja'] });
  }, [qc]);
  useCanal(['caja'], refrescar);

  if (isLoading) return <Cargando texto="Cargando caja…" />;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        {error && <Aviso>{error}</Aviso>}

        {!caja ? (
          <div className="tarjeta p-8 text-center">
            <p className="text-lg font-semibold text-slate-800">La caja está cerrada</p>
            <p className="mt-1 text-sm text-slate-500">
              Ábrela con el fondo inicial para poder cobrar en efectivo.
            </p>
            {puede('caja.abrir') && (
              <button
                data-guia="caja-abrir"
                className="boton-primario mt-4"
                onClick={() => setDialogo('abrir')}
              >
                Abrir caja
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="tarjeta p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Caja nº {caja.numero}</h1>
                  <p className="text-sm text-slate-500">
                    Abierta por {caja.abiertaPor.nombre} · {fechaHora(caja.abiertaEn)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {puede('caja.movimiento') && (
                    <button className="boton-secundario" onClick={() => setDialogo('movimiento')}>
                      Entrada / salida
                    </button>
                  )}
                  {puede('caja.cerrar') && (
                    <button
                      data-guia="caja-cerrar"
                      className="boton-primario"
                      onClick={() => setDialogo('cerrar')}
                    >
                      Cerrar caja (Z)
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Dato titulo="Venta total" valor={eur(caja.totales.ventaTotalCent)} destacado />
                <Dato titulo="Pedidos cobrados" valor={String(caja.totales.pedidosCobrados)} />
                <Dato titulo="Ticket medio" valor={eur(caja.totales.ticketMedioCent)} />
                <Dato titulo="Propinas" valor={eur(caja.totales.propinaTotalCent)} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div data-guia="caja-efectivo" className="tarjeta p-4">
                <h2 className="mb-3 font-bold text-slate-900">Efectivo en el cajón</h2>
                <dl className="space-y-1.5 text-sm">
                  <Linea texto="Fondo inicial" valor={eur(caja.saldoInicialCent)} />
                  <Linea texto="Cobrado en efectivo" valor={eur(caja.totales.efectivoCobradoCent)} />
                  <Linea texto="Entradas" valor={eur(caja.totales.entradasCent)} />
                  <Linea texto="Salidas" valor={`-${eur(caja.totales.salidasCent)}`} />
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-bold">Debería haber</span>
                    <span className="tabular text-lg font-bold">
                      {eur(caja.totales.saldoTeoricoCent)}
                    </span>
                  </div>
                </dl>
              </div>

              <div className="tarjeta p-4">
                <h2 className="mb-3 font-bold text-slate-900">Por forma de pago</h2>
                {caja.porMetodo.length === 0 ? (
                  <p className="text-sm text-slate-500">Todavía no hay cobros.</p>
                ) : (
                  <dl className="space-y-1.5 text-sm">
                    {caja.porMetodo.map((m) => (
                      <Linea
                        key={m.metodo}
                        texto={`${ETIQUETA_METODO[m.metodo] ?? m.metodo} (${m.num})`}
                        valor={eur(m.importeCent)}
                      />
                    ))}
                  </dl>
                )}
              </div>
            </div>

            <div data-guia="caja-movimientos" className="tarjeta p-4">
              <h2 className="mb-3 font-bold text-slate-900">Movimientos</h2>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {caja.movimientos.map((m) => (
                      <tr key={m.id}>
                        <td className="py-1.5 text-slate-500">{hora(m.creadoEn)}</td>
                        <td className="py-1.5">
                          <span className="chip bg-slate-100 text-slate-700">{m.tipo}</span>
                        </td>
                        <td className="py-1.5 text-slate-700">{m.motivo}</td>
                        <td className="py-1.5 text-slate-500">{m.usuario}</td>
                        <td
                          className={`tabular py-1.5 text-right font-semibold ${
                            ['SALIDA', 'RETIRADA', 'GASTO'].includes(m.tipo)
                              ? 'text-rose-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {['SALIDA', 'RETIRADA', 'GASTO'].includes(m.tipo) ? '-' : ''}
                          {eur(m.importeCent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="tarjeta p-4">
          <h2 className="mb-3 font-bold text-slate-900">Cierres anteriores</h2>
          {!sesiones?.length ? (
            <Vacio titulo="Aún no hay cierres" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-2">Nº</th>
                    <th>Apertura</th>
                    <th>Cierre</th>
                    <th>Responsable</th>
                    <th className="text-right">Venta</th>
                    <th className="text-right">Contado</th>
                    <th className="text-right">Descuadre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sesiones.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 font-semibold">{s.numero}</td>
                      <td className="text-slate-600">{fechaHora(s.abiertaEn)}</td>
                      <td className="text-slate-600">{s.cerradaEn ? fechaHora(s.cerradaEn) : '—'}</td>
                      <td className="text-slate-600">{s.cerradaPor ?? s.abiertaPor}</td>
                      <td className="tabular text-right">{eur(s.ventaTotalCent)}</td>
                      <td className="tabular text-right">
                        {s.saldoFinalContadoCent != null ? eur(s.saldoFinalContadoCent) : '—'}
                      </td>
                      <td
                        className={`tabular text-right font-semibold ${
                          !s.descuadreCent
                            ? 'text-slate-400'
                            : s.descuadreCent < 0
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                        }`}
                      >
                        {s.descuadreCent != null ? eur(s.descuadreCent) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DialogoAbrir
        abierto={dialogo === 'abrir'}
        onCerrar={() => setDialogo(null)}
        onHecho={() => {
          setDialogo(null);
          refrescar();
        }}
        onError={setError}
      />
      <DialogoMovimiento
        abierto={dialogo === 'movimiento'}
        onCerrar={() => setDialogo(null)}
        onHecho={() => {
          setDialogo(null);
          refrescar();
        }}
        onError={setError}
      />
      {caja && (
        <DialogoCierre
          abierto={dialogo === 'cerrar'}
          teoricoCent={caja.totales.saldoTeoricoCent}
          onCerrar={() => setDialogo(null)}
          onHecho={() => {
            setDialogo(null);
            refrescar();
            void qc.invalidateQueries({ queryKey: ['caja', 'sesiones'] });
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function Dato({ titulo, valor, destacado }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`tabular font-bold ${destacado ? 'text-2xl text-marca-700' : 'text-xl text-slate-900'}`}>
        {valor}
      </p>
    </div>
  );
}

function Linea({ texto, valor }: { texto: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{texto}</dt>
      <dd className="tabular font-medium text-slate-900">{valor}</dd>
    </div>
  );
}

function DialogoAbrir({
  abierto,
  onCerrar,
  onHecho,
  onError,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onHecho: () => void;
  onError: (e: string) => void;
}) {
  const [fondo, setFondo] = useState('150,00');
  const abrir = useMutation({
    mutationFn: () => api.post('/caja/abrir', { saldoInicialCent: aCentimos(fondo) }),
    onSuccess: onHecho,
    onError: (e) => onError(e instanceof ErrorApi ? e.message : 'No se pudo abrir'),
  });
  return (
    <Modal
      abierto={abierto}
      titulo="Abrir caja"
      onCerrar={onCerrar}
      pie={
        <button className="boton-primario" disabled={abrir.isPending} onClick={() => abrir.mutate()}>
          Abrir con {eur(aCentimos(fondo))}
        </button>
      }
    >
      <label className="etiqueta">Fondo de caja inicial</label>
      <input
        className="campo tabular text-lg"
        value={fondo}
        onChange={(e) => setFondo(e.target.value)}
        inputMode="decimal"
        autoFocus
      />
      <p className="mt-2 text-sm text-slate-500">
        El dinero que dejas en el cajón para dar cambios al empezar el turno.
      </p>
    </Modal>
  );
}

function DialogoMovimiento({
  abierto,
  onCerrar,
  onHecho,
  onError,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onHecho: () => void;
  onError: (e: string) => void;
}) {
  const [tipo, setTipo] = useState('SALIDA');
  const [importe, setImporte] = useState('');
  const [motivo, setMotivo] = useState('');
  const crear = useMutation({
    mutationFn: () =>
      api.post('/caja/movimientos', { tipo, importeCent: aCentimos(importe), motivo }),
    onSuccess: onHecho,
    onError: (e) => onError(e instanceof ErrorApi ? e.message : 'No se pudo registrar'),
  });
  return (
    <Modal
      abierto={abierto}
      titulo="Movimiento de caja"
      onCerrar={onCerrar}
      pie={
        <button
          className="boton-primario"
          disabled={!aCentimos(importe) || motivo.trim().length < 3 || crear.isPending}
          onClick={() => crear.mutate()}
        >
          Registrar
        </button>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {['ENTRADA', 'SALIDA', 'GASTO', 'RETIRADA'].map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                t === tipo ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div>
          <label className="etiqueta">Importe</label>
          <input
            className="campo tabular"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="etiqueta">Motivo</label>
          <input
            className="campo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Compra de hielo, cambio al banco…"
          />
        </div>
      </div>
    </Modal>
  );
}

function DialogoCierre({
  abierto,
  teoricoCent,
  onCerrar,
  onHecho,
  onError,
}: {
  abierto: boolean;
  teoricoCent: number;
  onCerrar: () => void;
  onHecho: () => void;
  onError: (e: string) => void;
}) {
  const [arqueo, setArqueo] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState('');

  const contadoCent = Object.entries(arqueo).reduce((a, [den, uds]) => a + Number(den) * uds, 0);
  const descuadre = contadoCent - teoricoCent;

  const cerrar = useMutation({
    mutationFn: () => api.post('/caja/cerrar', { arqueo, notas: notas || null }),
    onSuccess: onHecho,
    onError: (e) => onError(e instanceof ErrorApi ? e.message : 'No se pudo cerrar'),
  });

  return (
    <Modal
      abierto={abierto}
      titulo="Arqueo y cierre de caja"
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      pie={
        <>
          <button className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="boton-primario" disabled={cerrar.isPending} onClick={() => cerrar.mutate()}>
            {cerrar.isPending ? 'Cerrando…' : 'Cerrar caja'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Cuenta el cajón e introduce cuántas unidades hay de cada billete y moneda.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DENOMINACIONES.map((d) => (
            <div key={d}>
              <label className="etiqueta">{eur(d)}</label>
              <input
                className="campo tabular"
                type="number"
                min={0}
                value={arqueo[d] ?? ''}
                onChange={(e) =>
                  setArqueo((a) => ({ ...a, [d]: Math.max(0, Number(e.target.value) || 0) }))
                }
                placeholder="0"
              />
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Debería haber</span>
            <span className="tabular font-semibold">{eur(teoricoCent)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Contado</span>
            <span className="tabular font-semibold">{eur(contadoCent)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
            <span className="font-bold">Descuadre</span>
            <span
              className={`tabular text-lg font-bold ${
                descuadre === 0 ? 'text-emerald-600' : descuadre < 0 ? 'text-rose-600' : 'text-amber-600'
              }`}
            >
              {descuadre > 0 ? '+' : ''}
              {eur(descuadre)}
            </span>
          </div>
        </div>

        <div>
          <label className="etiqueta">Notas del cierre</label>
          <input
            className="campo"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Incidencias del turno…"
          />
        </div>
      </div>
    </Modal>
  );
}
