import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dayjs, eur, ETIQUETA_METODO } from '../lib/formato';
import { Cargando, Vacio } from '../components/ui';

type Pestana = 'ventas' | 'productos' | 'camareros' | 'juegos' | 'ocupacion';

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'ventas', texto: 'Ventas' },
  { id: 'productos', texto: 'Productos' },
  { id: 'camareros', texto: 'Camareros' },
  { id: 'juegos', texto: 'Ludoteca' },
  { id: 'ocupacion', texto: 'Ocupación' },
];

export default function Informes() {
  const [pestana, setPestana] = useState<Pestana>('ventas');
  const [desde, setDesde] = useState(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [hasta, setHasta] = useState(dayjs().format('YYYY-MM-DD'));

  const rango = `desde=${dayjs(desde).startOf('day').toISOString()}&hasta=${dayjs(hasta).endOf('day').toISOString()}`;

  const { data, isLoading } = useQuery<any>({
    queryKey: ['informe', pestana, rango],
    queryFn: () => api.get(`/informes/${pestana}?${rango}`),
  });

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex gap-1.5">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPestana(p.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  p.id === pestana ? 'bg-marca-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.texto}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="etiqueta">Desde</label>
              <input type="date" className="campo w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div>
              <label className="etiqueta">Hasta</label>
              <input type="date" className="campo w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {[
                { t: 'Hoy', d: 0 },
                { t: '7 días', d: 6 },
                { t: '30 días', d: 29 },
              ].map((r) => (
                <button
                  key={r.t}
                  className="boton-suave px-2 py-2 text-xs"
                  onClick={() => {
                    setDesde(dayjs().subtract(r.d, 'day').format('YYYY-MM-DD'));
                    setHasta(dayjs().format('YYYY-MM-DD'));
                  }}
                >
                  {r.t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading || !data ? (
          <Cargando />
        ) : pestana === 'ventas' ? (
          <Ventas datos={data} />
        ) : pestana === 'productos' ? (
          <Productos datos={data} />
        ) : pestana === 'camareros' ? (
          <Camareros datos={data} />
        ) : pestana === 'juegos' ? (
          <Ludoteca datos={data} />
        ) : (
          <Ocupacion datos={data} />
        )}
      </div>
    </div>
  );
}

/** Barras horizontales simples: legibles sin depender de una librería. */
function Barras({
  filas,
  formato = eur,
}: {
  filas: { etiqueta: string; valor: number; nota?: string }[];
  formato?: (n: number) => string;
}) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-1.5">
      {filas.map((f, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-slate-700">{f.etiqueta}</span>
          <span className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <span
              className="block h-full rounded bg-marca-500"
              style={{ width: `${Math.max(2, (f.valor / max) * 100)}%` }}
            />
          </span>
          <span className="tabular w-24 shrink-0 text-right text-sm font-semibold text-slate-900">
            {formato(f.valor)}
          </span>
          {f.nota && <span className="w-20 shrink-0 text-right text-xs text-slate-500">{f.nota}</span>}
        </li>
      ))}
    </ul>
  );
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="tarjeta p-4">
      <h2 className="mb-3 font-bold text-slate-900">{titulo}</h2>
      {children}
    </div>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="tabular text-2xl font-bold text-slate-900">{valor}</p>
    </div>
  );
}

function Ventas({ datos }: { datos: any }) {
  const dias = datos.porDia ?? [];
  const pedidos = dias.reduce((a: number, d: any) => a + d.pedidos, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Cifra titulo="Venta total" valor={eur(datos.totalCent)} />
        <Cifra titulo="Pedidos" valor={String(pedidos)} />
        <Cifra titulo="Ticket medio" valor={eur(pedidos ? Math.round(datos.totalCent / pedidos) : 0)} />
        <Cifra titulo="Propinas" valor={eur(datos.propinaCent)} />
      </div>

      <Panel titulo="Venta por día">
        {dias.length === 0 ? (
          <Vacio titulo="Sin ventas en el periodo" />
        ) : (
          <Barras
            filas={dias.map((d: any) => ({
              etiqueta: dayjs(d.dia).format('ddd DD/MM'),
              valor: d.ventaCent,
              nota: `${d.pedidos} ped.`,
            }))}
          />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Por forma de pago">
          <Barras
            filas={(datos.porMetodo ?? [])
              .filter((m: any) => m.importeCent > 0)
              .map((m: any) => ({
                etiqueta: ETIQUETA_METODO[m.metodo] ?? m.metodo,
                valor: m.importeCent,
                nota: `${m.num}`,
              }))}
          />
        </Panel>
        <Panel titulo="Por franja horaria">
          <Barras
            filas={(datos.porHora ?? [])
              .filter((h: any) => h.ventaCent > 0)
              .map((h: any) => ({ etiqueta: `${String(h.hora).padStart(2, '0')}:00`, valor: h.ventaCent }))}
          />
        </Panel>
      </div>
    </div>
  );
}

function Productos({ datos }: { datos: any }) {
  return (
    <div className="space-y-4">
      <Panel titulo="Por categoría">
        <Barras
          filas={(datos.porCategoria ?? []).map((c: any) => ({
            etiqueta: c.categoria,
            valor: c.importeCent,
            nota: `${c.unidades} ud.`,
          }))}
        />
      </Panel>
      <Panel titulo="Productos más vendidos">
        {datos.productos?.length === 0 ? (
          <Vacio titulo="Sin ventas en el periodo" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2">Producto</th>
                  <th>Categoría</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(datos.productos ?? []).slice(0, 40).map((p: any) => (
                  <tr key={p.nombre}>
                    <td className="py-1.5 font-medium text-slate-800">{p.nombre}</td>
                    <td className="text-slate-500">{p.categoria}</td>
                    <td className="tabular text-right">{p.unidades}</td>
                    <td className="tabular text-right font-semibold">{eur(p.importeCent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Camareros({ datos }: { datos: any }) {
  return (
    <Panel titulo="Rendimiento por camarero">
      {datos.camareros?.length === 0 ? (
        <Vacio titulo="Sin datos en el periodo" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2">Camarero</th>
              <th className="text-right">Pedidos</th>
              <th className="text-right">Comensales</th>
              <th className="text-right">Venta</th>
              <th className="text-right">Ticket medio</th>
              <th className="text-right">Por comensal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(datos.camareros ?? []).map((c: any) => (
              <tr key={c.nombre}>
                <td className="py-2 font-medium text-slate-800">{c.nombre}</td>
                <td className="tabular text-right">{c.pedidos}</td>
                <td className="tabular text-right">{c.comensales}</td>
                <td className="tabular text-right font-semibold">{eur(c.ventaCent)}</td>
                <td className="tabular text-right">{eur(c.ticketMedioCent)}</td>
                <td className="tabular text-right">{eur(c.gastoPorComensalCent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function Ludoteca({ datos }: { datos: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra titulo="Préstamos" valor={String(datos.totalPrestamos)} />
        <Cifra titulo="Ingresos por cover" valor={eur(datos.coverTotalCent)} />
        <Cifra
          titulo="Personas con cover"
          valor={String((datos.cover ?? []).reduce((a: number, c: any) => a + c.personas, 0))}
        />
      </div>
      <Panel titulo="Cover cobrado">
        <Barras
          filas={(datos.cover ?? []).map((c: any) => ({
            etiqueta: c.nombre,
            valor: c.importeCent,
            nota: `${c.personas} pax`,
          }))}
        />
      </Panel>
      <Panel titulo="Juegos más jugados">
        {datos.juegos?.length === 0 ? (
          <Vacio titulo="Todavía no se ha prestado ningún juego" />
        ) : (
          <Barras
            filas={(datos.juegos ?? []).slice(0, 25).map((j: any) => ({
              etiqueta: j.nombre,
              valor: j.veces,
              nota: `${j.mediaMin} min`,
            }))}
            formato={(n) => `${n} veces`}
          />
        )}
      </Panel>
    </div>
  );
}

function Ocupacion({ datos }: { datos: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Cifra titulo="Reservas" valor={String(datos.reservas.total)} />
        <Cifra titulo="Personas reservadas" valor={String(datos.reservas.personas)} />
        <Cifra titulo="Servicios" valor={String(datos.servicios.pedidos)} />
        <Cifra titulo="Duración media" valor={`${datos.servicios.duracionMediaMin} min`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Reservas por estado">
          <Barras
            filas={datos.reservas.porEstado.map((e: any) => ({ etiqueta: e.estado, valor: e.num }))}
            formato={(n) => String(n)}
          />
        </Panel>
        <Panel titulo="Reservas por origen">
          <Barras
            filas={datos.reservas.porOrigen.map((o: any) => ({ etiqueta: o.origen, valor: o.num }))}
            formato={(n) => String(n)}
          />
        </Panel>
      </div>
    </div>
  );
}
