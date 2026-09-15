import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi, imprimirRecibo } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { dayjs, eur, fechaHora } from '../lib/formato';
import type { Factura } from '../lib/tipos';
import { Cargando, Chip, Modal, Aviso, Vacio } from '../components/ui';

export default function Facturas() {
  const qc = useQueryClient();
  const puede = useSesion((s) => s.puede);
  const [desde, setDesde] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [hasta, setHasta] = useState(dayjs().format('YYYY-MM-DD'));
  const [texto, setTexto] = useState('');
  const [rectificar, setRectificar] = useState<Factura | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parametros = new URLSearchParams({
    desde: dayjs(desde).startOf('day').toISOString(),
    hasta: dayjs(hasta).endOf('day').toISOString(),
  });
  if (texto) parametros.set('texto', texto);

  const { data: facturas, isLoading } = useQuery<Factura[]>({
    queryKey: ['facturas', parametros.toString()],
    queryFn: () => api.get(`/cobros/facturas?${parametros.toString()}`),
  });

  const { data: cadena } = useQuery<{ ok: boolean; total: number; rotaEn?: string; detalle?: string }>({
    queryKey: ['cadena'],
    queryFn: () => api.get('/cobros/facturas-verificar'),
    enabled: puede('informes.ver'),
  });

  const { data: libro } = useQuery<any>({
    queryKey: ['libro-iva', desde, hasta],
    queryFn: () =>
      api.get(
        `/cobros/libro-iva?desde=${dayjs(desde).startOf('day').toISOString()}&hasta=${dayjs(hasta).endOf('day').toISOString()}`,
      ),
    enabled: puede('informes.ver'),
  });

  const emitirRectificativa = useMutation({
    mutationFn: (id: string) => api.post(`/cobros/facturas/${id}/rectificar`, { motivo }),
    onSuccess: () => {
      setRectificar(null);
      setMotivo('');
      void qc.invalidateQueries({ queryKey: ['facturas'] });
      void qc.invalidateQueries({ queryKey: ['cadena'] });
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo rectificar'),
  });

  const lista = facturas ?? [];

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="etiqueta">Desde</label>
            <input type="date" className="campo w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="etiqueta">Hasta</label>
            <input type="date" className="campo w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="etiqueta">Buscar</label>
            <input
              className="campo max-w-xs"
              placeholder="Código, cliente o NIF…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
        </div>

        {error && <Aviso>{error}</Aviso>}

        {cadena && (
          <Aviso tono={cadena.ok ? 'ok' : 'error'}>
            {cadena.ok ? (
              <>
                Registro de facturación íntegro: {cadena.total} facturas encadenadas y verificadas.
              </>
            ) : (
              <>
                ⚠ La cadena de huellas se rompe en <strong>{cadena.rotaEn}</strong>: {cadena.detalle}
              </>
            )}
          </Aviso>
        )}

        {libro?.resumen?.length > 0 && (
          <div className="tarjeta p-4">
            <h2 className="mb-3 font-bold text-slate-900">IVA repercutido del periodo</h2>
            <table className="w-full max-w-md text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-1.5">Tipo</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">Cuota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {libro.resumen.map((r: any) => (
                  <tr key={r.ivaTipo}>
                    <td className="py-1.5 font-medium">{r.ivaTipo}%</td>
                    <td className="tabular text-right">{eur(r.baseCent)}</td>
                    <td className="tabular text-right">{eur(r.cuotaCent)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-1.5">Total</td>
                  <td className="tabular text-right">{eur(libro.totales.baseCent)}</td>
                  <td className="tabular text-right">{eur(libro.totales.cuotaCent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="tarjeta overflow-hidden">
          {isLoading ? (
            <Cargando />
          ) : lista.length === 0 ? (
            <Vacio titulo="No hay facturas en ese periodo" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Código</th>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Cliente</th>
                    <th className="text-right">Base</th>
                    <th className="text-right">IVA</th>
                    <th className="text-right">Total</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{f.codigo}</td>
                      <td className="text-slate-600">{fechaHora(f.fechaEmision)}</td>
                      <td className="text-slate-600">
                        {f.tipo === 'SIMPLIFICADA' ? 'Ticket' : f.tipo === 'COMPLETA' ? 'Factura' : 'Rectificativa'}
                      </td>
                      <td className="text-slate-600">
                        {f.clienteNombre ?? '—'}
                        {f.clienteNif && <span className="block text-[11px] text-slate-400">{f.clienteNif}</span>}
                      </td>
                      <td className="tabular text-right">{eur(f.baseCent)}</td>
                      <td className="tabular text-right">{eur(f.cuotaCent)}</td>
                      <td className="tabular text-right font-semibold">{eur(f.totalCent)}</td>
                      <td>
                        <Chip estado={f.estado} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5">
                          <button
                            className="boton-secundario px-2 py-1 text-xs"
                            onClick={() => void imprimirRecibo(f.id)}
                          >
                            Recibo
                          </button>
                          {puede('factura.rectificar') && f.estado === 'EMITIDA' && f.tipo !== 'RECTIFICATIVA' && (
                            <button
                              className="boton-secundario px-2 py-1 text-xs text-rose-600"
                              onClick={() => {
                                setRectificar(f);
                                setError(null);
                              }}
                            >
                              Rectificar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        abierto={!!rectificar}
        titulo={`Rectificar ${rectificar?.codigo ?? ''}`}
        onCerrar={() => setRectificar(null)}
        pie={
          <>
            <button className="boton-secundario" onClick={() => setRectificar(null)}>
              Cancelar
            </button>
            <button
              className="boton-peligro"
              disabled={motivo.trim().length < 3 || emitirRectificativa.isPending}
              onClick={() => rectificar && emitirRectificativa.mutate(rectificar.id)}
            >
              Emitir rectificativa
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Aviso tono="info">
            Una factura emitida no se borra ni se modifica. Se emite otra en negativo que la anula,
            y ambas quedan en el registro.
          </Aviso>
          <div>
            <label className="etiqueta">Motivo de la rectificación</label>
            <input
              className="campo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Error en los datos del cliente, devolución…"
              autoFocus
            />
          </div>
          {rectificar && (
            <p className="text-sm text-slate-600">
              Se emitirá una rectificativa por{' '}
              <span className="tabular font-bold">{eur(-rectificar.totalCent)}</span>.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
