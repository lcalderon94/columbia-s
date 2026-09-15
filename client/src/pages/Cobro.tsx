import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi, imprimirRecibo } from '../lib/api';
import { eur, aCentimos, ETIQUETA_METODO } from '../lib/formato';
import type { Pedido } from '../lib/tipos';
import { Cargando, Modal, Aviso, TecladoNumerico } from '../components/ui';

interface PagoBorrador {
  metodo: string;
  importeCent: number;
  propinaCent: number;
  entregadoCent?: number;
  refAutorizacion?: string;
  ultimos4?: string;
}

const METODOS = ['EFECTIVO', 'TARJETA', 'BIZUM', 'VALE'] as const;

export default function Cobro() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const qc = useQueryClient();

  const [pagos, setPagos] = useState<PagoBorrador[]>([]);
  const [importe, setImporte] = useState('');
  const [metodo, setMetodo] = useState<string>('TARJETA');
  const [propina, setPropina] = useState('');
  const [entregado, setEntregado] = useState('');
  const [refAut, setRefAut] = useState('');
  const [ultimos4, setUltimos4] = useState('');
  const [conFactura, setConFactura] = useState(true);
  const [tipoFactura, setTipoFactura] = useState<'SIMPLIFICADA' | 'COMPLETA'>('SIMPLIFICADA');
  const [cliente, setCliente] = useState({ nombre: '', nif: '', direccion: '', cp: '', ciudad: '' });
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ codigo: string; facturaId: string } | null>(null);
  const [dividir, setDividir] = useState<number | null>(null);

  const { data: pedido, isLoading } = useQuery<Pedido>({
    queryKey: ['pedido', id],
    queryFn: () => api.get(`/pedidos/${id}`),
  });

  const cobrar = useMutation({
    mutationFn: (cuerpo: unknown) => api.post<any>(`/cobros/pedido/${id}/cobrar`, cuerpo),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['sala'] });
      void qc.invalidateQueries({ queryKey: ['pedido', id] });
      void qc.invalidateQueries({ queryKey: ['hoy'] });
      void qc.invalidateQueries({ queryKey: ['caja'] });
      if (r.factura) setResultado({ codigo: r.factura.codigo, facturaId: r.factura.id });
      else navegar('/sala');
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo cobrar'),
  });

  if (isLoading || !pedido) return <Cargando texto="Cargando cuenta…" />;

  const pendienteTotal = pedido.totales.pendienteCent;
  const yaRepartido = pagos.reduce((a, p) => a + p.importeCent, 0);
  const restante = pendienteTotal - yaRepartido;
  const importeCent = importe ? aCentimos(importe) : restante;
  const entregadoCent = aCentimos(entregado);
  const cambioCent = Math.max(0, entregadoCent - importeCent);

  const anadirPago = () => {
    if (importeCent <= 0 || importeCent > restante) {
      setError(`El importe debe estar entre 0,01 € y ${eur(restante)}`);
      return;
    }
    setPagos((p) => [
      ...p,
      {
        metodo,
        importeCent,
        propinaCent: aCentimos(propina),
        ...(metodo === 'EFECTIVO' && entregadoCent ? { entregadoCent } : {}),
        ...(metodo === 'TARJETA' && refAut ? { refAutorizacion: refAut } : {}),
        ...(metodo === 'TARJETA' && ultimos4.length === 4 ? { ultimos4 } : {}),
      },
    ]);
    setImporte('');
    setPropina('');
    setEntregado('');
    setRefAut('');
    setUltimos4('');
    setError(null);
  };

  const finalizar = () => {
    const lista = pagos.length
      ? pagos
      : [
          {
            metodo,
            importeCent: pendienteTotal,
            propinaCent: aCentimos(propina),
            ...(metodo === 'EFECTIVO' && entregadoCent ? { entregadoCent } : {}),
            ...(metodo === 'TARJETA' && refAut ? { refAutorizacion: refAut } : {}),
            ...(metodo === 'TARJETA' && ultimos4.length === 4 ? { ultimos4 } : {}),
          },
        ];
    const sumado = lista.reduce((a, p) => a + p.importeCent, 0);
    if (sumado !== pendienteTotal) {
      setError(`Faltan ${eur(pendienteTotal - sumado)} por repartir`);
      return;
    }
    if (tipoFactura === 'COMPLETA' && !cliente.nif.trim()) {
      setError('Una factura completa necesita el NIF del cliente');
      return;
    }
    cobrar.mutate({
      pagos: lista,
      emitirFactura: conFactura,
      tipoFactura,
      cliente: tipoFactura === 'COMPLETA' ? cliente : undefined,
    });
  };

  return (
    <div className="flex h-full">
      {/* -- Resumen de la cuenta -------------------------------------- */}
      <div className="flex w-[360px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-lg font-bold text-slate-900">
            {pedido.mesa ? `Mesa ${pedido.mesa.nombre}` : pedido.tipo}
          </p>
          <p className="text-xs text-slate-500">
            Pedido #{pedido.numero} · {pedido.comensales} pax
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ul className="space-y-1.5 text-sm">
            {pedido.lineas
              .filter((l) => l.estado !== 'ANULADO')
              .map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    <span className="tabular mr-1.5 font-semibold">{l.cantidad}×</span>
                    {l.nombre}
                  </span>
                  <span className={`tabular ${l.invitada ? 'text-slate-400 line-through' : ''}`}>
                    {eur(l.brutoCent)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
        <div className="space-y-1 border-t border-slate-200 px-4 py-3 text-sm">
          {pedido.totales.descuentoTotalCent > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Descuento</span>
              <span className="tabular">-{eur(pedido.totales.descuentoTotalCent)}</span>
            </div>
          )}
          {pedido.totales.desglose.map((d) => (
            <div key={d.ivaTipo} className="flex justify-between text-xs text-slate-500">
              <span>
                Base {d.ivaTipo}% · IVA {eur(d.cuotaCent)}
              </span>
              <span className="tabular">{eur(d.baseCent)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-base font-bold">Total</span>
            <span className="tabular text-2xl font-bold">{eur(pedido.totales.totalCent)}</span>
          </div>
          {pedido.totales.cobradoCent > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Ya cobrado</span>
              <span className="tabular">{eur(pedido.totales.cobradoCent)}</span>
            </div>
          )}
        </div>
      </div>

      {/* -- Panel de cobro -------------------------------------------- */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900">Cobrar</h1>
            <button className="boton-secundario" onClick={() => navegar(`/pedido/${id}`)}>
              ← Volver al pedido
            </button>
          </div>

          {error && <Aviso>{error}</Aviso>}

          <div className="tarjeta p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Queda por cobrar</span>
              <span className="tabular text-2xl font-bold text-marca-700">{eur(restante)}</span>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodo(m)}
                  className={`rounded-lg py-3 text-sm font-semibold transition ${
                    m === metodo ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {ETIQUETA_METODO[m]}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="etiqueta">Importe (vacío = todo lo pendiente)</label>
                  <input
                    className="campo tabular text-lg"
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    placeholder={eur(restante)}
                    inputMode="decimal"
                  />
                </div>

                {metodo === 'EFECTIVO' && (
                  <>
                    <div>
                      <label className="etiqueta">Entregado</label>
                      <input
                        className="campo tabular"
                        value={entregado}
                        onChange={(e) => setEntregado(e.target.value)}
                        placeholder="0,00"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[500, 1000, 2000, 5000].map((c) => (
                        <button
                          key={c}
                          className="boton-suave"
                          onClick={() => setEntregado(String(c / 100).replace('.', ','))}
                        >
                          {eur(c)}
                        </button>
                      ))}
                    </div>
                    {cambioCent > 0 && (
                      <div className="rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
                        <span className="text-sm text-emerald-800">Cambio a devolver </span>
                        <span className="tabular text-lg font-bold text-emerald-900">
                          {eur(cambioCent)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {metodo === 'TARJETA' && (
                  <>
                    <Aviso tono="info">
                      Pasa la tarjeta por el datáfono y anota aquí la referencia del recibo.
                    </Aviso>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="etiqueta">Nº autorización</label>
                        <input
                          className="campo tabular"
                          value={refAut}
                          onChange={(e) => setRefAut(e.target.value)}
                          placeholder="004521"
                        />
                      </div>
                      <div>
                        <label className="etiqueta">Últimos 4</label>
                        <input
                          className="campo tabular"
                          value={ultimos4}
                          onChange={(e) => setUltimos4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="4242"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="etiqueta">Propina (opcional)</label>
                  <input
                    className="campo tabular"
                    value={propina}
                    onChange={(e) => setPropina(e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div>
                <TecladoNumerico
                  conDecimal
                  onTecla={(d) => setImporte((v) => v + d)}
                  onBorrar={() => setImporte((v) => v.slice(0, -1))}
                  onLimpiar={() => setImporte('')}
                />
                <button className="boton-secundario mt-2 w-full" onClick={() => setDividir(2)}>
                  Dividir a partes iguales
                </button>
              </div>
            </div>

            {pagos.length > 0 && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="etiqueta">Cobros preparados</p>
                <ul className="space-y-1">
                  {pagos.map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span>
                        {ETIQUETA_METODO[p.metodo]}
                        {p.ultimos4 && ` ****${p.ultimos4}`}
                        {p.propinaCent > 0 && ` · propina ${eur(p.propinaCent)}`}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular font-semibold">{eur(p.importeCent)}</span>
                        <button
                          className="text-rose-600 hover:text-rose-800"
                          onClick={() => setPagos((s) => s.filter((_, j) => j !== i))}
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                className="boton-secundario flex-1"
                disabled={restante <= 0}
                onClick={anadirPago}
              >
                Añadir cobro parcial
              </button>
              <button
                className="boton-primario flex-1"
                disabled={cobrar.isPending || pendienteTotal <= 0}
                onClick={finalizar}
              >
                {cobrar.isPending ? 'Cobrando…' : `Cobrar ${eur(pendienteTotal)}`}
              </button>
            </div>
          </div>

          <div className="tarjeta p-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-marca-600"
                checked={conFactura}
                onChange={(e) => setConFactura(e.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-800">Emitir factura y recibo</span>
            </label>

            {conFactura && (
              <>
                <div className="mt-3 flex gap-2">
                  {(['SIMPLIFICADA', 'COMPLETA'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTipoFactura(t)}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                        t === tipoFactura ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t === 'SIMPLIFICADA' ? 'Ticket (simplificada)' : 'Factura con NIF'}
                    </button>
                  ))}
                </div>

                {tipoFactura === 'COMPLETA' && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="etiqueta">Nombre o razón social</label>
                      <input
                        className="campo"
                        value={cliente.nombre}
                        onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="etiqueta">NIF / CIF</label>
                      <input
                        className="campo"
                        value={cliente.nif}
                        onChange={(e) => setCliente({ ...cliente, nif: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="etiqueta">Dirección</label>
                      <input
                        className="campo"
                        value={cliente.direccion}
                        onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="etiqueta">CP</label>
                      <input
                        className="campo"
                        value={cliente.cp}
                        onChange={(e) => setCliente({ ...cliente, cp: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="etiqueta">Ciudad</label>
                      <input
                        className="campo"
                        value={cliente.ciudad}
                        onChange={(e) => setCliente({ ...cliente, ciudad: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reparto a partes iguales */}
      <Modal abierto={dividir !== null} titulo="Dividir a partes iguales" onCerrar={() => setDividir(null)}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                onClick={() => setDividir(n)}
                className={`h-12 w-12 rounded-lg font-bold transition ${
                  n === dividir ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {dividir && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm text-slate-600">
                {dividir} partes de{' '}
                <span className="tabular font-bold">
                  {eur(Math.floor(pendienteTotal / dividir))}
                </span>
                {pendienteTotal % dividir !== 0 && (
                  <span className="text-slate-500">
                    {' '}
                    (las primeras {pendienteTotal % dividir} llevan un céntimo más)
                  </span>
                )}
              </p>
              <button
                className="boton-primario mt-3 w-full"
                onClick={() => {
                  setImporte(String(Math.floor(pendienteTotal / dividir) / 100).replace('.', ','));
                  setDividir(null);
                }}
              >
                Usar ese importe
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Cobro terminado */}
      <Modal
        abierto={!!resultado}
        titulo="Cobro realizado"
        onCerrar={() => navegar('/sala')}
        pie={
          <>
            <button className="boton-secundario" onClick={() => navegar('/sala')}>
              Volver a sala
            </button>
            <button
              className="boton-primario"
              onClick={() => resultado && void imprimirRecibo(resultado.facturaId)}
            >
              Imprimir recibo
            </button>
          </>
        }
      >
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="text-lg font-bold text-slate-900">{eur(pedido.totales.totalCent)} cobrados</p>
          <p className="mt-1 text-sm text-slate-500">Factura {resultado?.codigo}</p>
        </div>
      </Modal>
    </div>
  );
}
