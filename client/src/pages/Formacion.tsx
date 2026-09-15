import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../lib/api';
import { usePracticas } from '../lib/practicas';
import { lanzarGuia, marcarGuiaCompletada } from '../lib/tour';
import { GUIAS } from '../lib/guias';
import { eur, aCentimos } from '../lib/formato';
import { Modal, Aviso, Cargando } from '../components/ui';

interface Progreso {
  guias: { id: string; titulo: string; completada: boolean; esencial: boolean }[];
  listo: boolean;
  completadas: number;
  total: number;
}

export default function Formacion() {
  const qc = useQueryClient();
  const navegar = useNavigate();
  const practicas = usePracticas();
  const [error, setError] = useState<string | null>(null);
  const [simulador, setSimulador] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const { data: progreso, isLoading } = useQuery<Progreso>({
    queryKey: ['formacion'],
    queryFn: () => api.get('/formacion'),
  });

  const { data: practicasAbiertas } = useQuery<{ total: number }>({
    queryKey: ['formacion', 'practicas'],
    queryFn: () => api.get('/formacion/practicas'),
    refetchInterval: 15_000,
  });

  const borrarPracticas = useMutation({
    mutationFn: () => api.del<{ ok: boolean; borrados: number; motivo?: string }>('/formacion/practicas'),
    onSuccess: (r) => {
      setConfirmarBorrado(false);
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudieron borrar');
        return;
      }
      practicas.desactivar();
      qc.invalidateQueries({ queryKey: ['formacion'] });
      qc.invalidateQueries({ queryKey: ['sala'] });
      qc.invalidateQueries({ queryKey: ['cocina'] });
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudieron borrar'),
  });

  const reiniciar = useMutation({
    mutationFn: () => api.del('/formacion/progreso'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['formacion'] }),
  });

  /** Abre la pantalla que toca y lanza la guía cuando ya está pintada. */
  const empezar = async (guiaId: string) => {
    const guia = GUIAS.find((g) => g.id === guiaId);
    if (!guia) return;
    setError(null);

    try {
      if (guia.necesitaPedido) {
        // Las guías de comanda y cobro se practican sobre un pedido real
        // marcado como formación, que luego se borra.
        practicas.activar();
        const pedidoId = await pedidoDePracticas(guia.pedidoConLineas, guia.pedidoVacio);
        navegar(guia.id === 'cobro' ? `/cobro/${pedidoId}` : `/pedido/${pedidoId}`);
        setTimeout(() => lanzar(guiaId, pedidoId), 900);
        return;
      }
      navegar(guia.ruta);
      setTimeout(() => lanzar(guiaId), 700);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo abrir la guía');
    }
  };

  const lanzar = (guiaId: string, pedidoId?: string) =>
    lanzarGuia({
      guiaId,
      pedidoId,
      alTerminar: async (completada) => {
        if (!completada) return;
        await marcarGuiaCompletada(guiaId);
        // El cliente de consultas vive en la aplicación, no en esta pantalla,
        // así que invalidar sigue funcionando aunque ya no estemos aquí.
        void qc.invalidateQueries({ queryKey: ['formacion'] });
      },
    });

  if (isLoading || !progreso) return <Cargando texto="Cargando formación…" />;

  const esenciales = progreso.guias.filter((g) => g.esencial);
  const resto = progreso.guias.filter((g) => !g.esencial);
  const pct = Math.round((progreso.completadas / progreso.total) * 100);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="tarjeta p-5">
          <h1 className="text-2xl font-bold text-slate-900">Formación</h1>
          <p className="mt-1 text-sm text-slate-600">
            Guías cortas que te llevan por el programa señalando cada botón. Puedes salir con{' '}
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">Esc</kbd> y
            retomarlas cuando quieras.
          </p>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {progreso.completadas} de {progreso.total} completadas
              </span>
              <span className="tabular text-slate-500">{pct}%</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-marca-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {progreso.listo ? (
            <div className="mt-3">
              <Aviso tono="ok">
                Tienes hechas las guías que tocan dinero. Ya puedes trabajar en barra.
              </Aviso>
            </div>
          ) : (
            <div className="mt-3">
              <Aviso tono="info">
                Antes de tu primer turno, haz al menos las marcadas como{' '}
                <strong>imprescindibles</strong>.
              </Aviso>
            </div>
          )}
        </div>

        {error && <Aviso>{error}</Aviso>}

        {practicasAbiertas && practicasAbiertas.total > 0 && (
          <div className="tarjeta border-l-4 border-violet-500 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  Hay {practicasAbiertas.total} pedido(s) de prácticas
                </p>
                <p className="text-sm text-slate-600">
                  No cuentan como venta ni han emitido factura, pero ocupan mesa. Bórralos al
                  terminar.
                </p>
              </div>
              <button className="boton-primario" onClick={() => setConfirmarBorrado(true)}>
                Borrar datos de prácticas
              </button>
            </div>
          </div>
        )}

        <Seccion
          titulo="Imprescindibles"
          subtitulo="Lo que hay que saber antes de tocar dinero."
          guias={esenciales}
          onEmpezar={empezar}
        />

        <Seccion
          titulo="El resto"
          subtitulo="Cuando tengas un rato."
          guias={resto}
          onEmpezar={empezar}
        />

        <div className="tarjeta p-4">
          <h2 className="font-bold text-slate-900">Practicar el arqueo</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cuenta un cajón de mentira y mira cómo sale el descuadre. No toca la caja de verdad.
          </p>
          <button
            data-guia="sim-abrir"
            className="boton-secundario mt-3"
            onClick={() => setSimulador(true)}
          >
            Abrir simulador de arqueo
          </button>
        </div>

        <div className="pb-4 text-center">
          <button
            className="text-sm text-slate-400 hover:text-slate-600"
            onClick={() => reiniciar.mutate()}
          >
            Empezar la formación de cero
          </button>
        </div>
      </div>

      <SimuladorArqueo abierto={simulador} onCerrar={() => setSimulador(false)} />

      <Modal
        abierto={confirmarBorrado}
        titulo="Borrar los datos de prácticas"
        onCerrar={() => setConfirmarBorrado(false)}
        pie={
          <>
            <button className="boton-secundario" onClick={() => setConfirmarBorrado(false)}>
              Cancelar
            </button>
            <button
              className="boton-peligro"
              disabled={borrarPracticas.isPending}
              onClick={() => borrarPracticas.mutate()}
            >
              Sí, borrar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Se borran los pedidos de formación y se liberan sus mesas.
          </p>
          <Aviso tono="ok">
            Es seguro: un pedido de prácticas nunca emitió factura ni entró en la caja, así que no
            hay nada contable que se pueda descuadrar.
          </Aviso>
        </div>
      </Modal>
    </div>
  );
}

function Seccion({
  titulo,
  subtitulo,
  guias,
  onEmpezar,
}: {
  titulo: string;
  subtitulo: string;
  guias: Progreso['guias'];
  onEmpezar: (id: string) => void;
}) {
  return (
    <div className="tarjeta overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-bold text-slate-900">{titulo}</h2>
        <p className="text-sm text-slate-500">{subtitulo}</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {guias.map((g) => {
          const detalle = GUIAS.find((x) => x.id === g.id);
          return (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  g.completada ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {g.completada ? '✓' : '○'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{detalle?.titulo ?? g.titulo}</p>
                <p className="text-sm text-slate-500">{detalle?.descripcion}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{detalle?.minutos} min</span>
              <button className="boton-secundario shrink-0" onClick={() => onEmpezar(g.id)}>
                {g.completada ? 'Repetir' : 'Empezar'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Abre (o reutiliza) un pedido de prácticas sobre la primera mesa libre.
 *
 * La guía de cobro necesita que ya haya algo que cobrar, así que en ese caso
 * se le ponen un par de líneas: si no, el empleado llegaría a la pantalla de
 * cobro con la cuenta a cero y sin nada que aprender.
 */
async function pedidoDePracticas(conLineas = false, exigirVacio = false): Promise<string> {
  const abiertos = await api.get<{ pedidos: { id: string; estado: string }[] }>(
    '/formacion/practicas',
  );
  // Un pedido vacío se puede reaprovechar; uno con líneas no, porque dejaría
  // las tareas de la guía ya cumplidas de partida.
  let vivo = abiertos.pedidos.find((p) => p.estado === 'ABIERTO' || p.estado === 'PARA_COBRAR');
  if (vivo && exigirVacio) {
    const actual = await api.get<{ lineas: unknown[] }>(`/pedidos/${vivo.id}`);
    if (actual.lineas.length > 0) vivo = undefined;
  }

  let pedidoId: string;
  if (vivo) {
    pedidoId = vivo.id;
  } else {
    const sala = await api.get<{ zonas: { mesas: { id: string; estado: string }[] }[] }>('/sala');
    const libre = sala.zonas.flatMap((z) => z.mesas).find((m) => m.estado === 'LIBRE');
    if (!libre) throw new ErrorApi(409, 'No hay ninguna mesa libre para practicar');

    const pedido = await api.post<{ id: string }>('/pedidos', {
      tipo: 'MESA',
      mesaId: libre.id,
      comensales: 2,
      esPractica: true,
    });
    pedidoId = pedido.id;
  }

  if (conLineas) {
    const actual = await api.get<{ totales: { totalCent: number } }>(`/pedidos/${pedidoId}`);
    if (actual.totales.totalCent === 0) {
      const carta = await api.get<
        { nombre: string; productos: { id: string; nombre: string }[] }[]
      >('/carta');
      const todos = carta.flatMap((c) => c.productos);
      const burger = todos.find((x) => x.nombre.includes('Classic'));
      const cana = todos.find((x) => x.nombre === 'Caña');
      const lineas = [
        burger && { productoId: burger.id, cantidad: 2 },
        cana && { productoId: cana.id, cantidad: 2 },
      ].filter(Boolean);
      if (lineas.length) {
        await api.post(`/pedidos/${pedidoId}/lineas`, { lineas });
      }
    }
  }

  return pedidoId;
}

const DENOMINACIONES = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

/**
 * Cajón de mentira para practicar el arqueo: se cuenta, se compara con lo
 * que "debería haber" y se ve el descuadre. No llama a la API.
 */
function SimuladorArqueo({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [teorico, setTeorico] = useState('347,80');
  const [arqueo, setArqueo] = useState<Record<string, number>>({});

  const teoricoCent = aCentimos(teorico);
  const contadoCent = Object.entries(arqueo).reduce((a, [d, u]) => a + Number(d) * u, 0);
  const descuadre = contadoCent - teoricoCent;
  const hayAlgo = contadoCent > 0;

  return (
    <Modal
      abierto={abierto}
      titulo="Simulador de arqueo"
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      pie={
        <>
          <button className="boton-secundario" onClick={() => setArqueo({})}>
            Vaciar
          </button>
          <button className="boton-primario" onClick={onCerrar}>
            Cerrar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Aviso tono="info">
          Esto es una simulación: no cierra ninguna caja ni guarda nada. Practica hasta que el
          descuadre te salga a cero.
        </Aviso>

        <div>
          <label className="etiqueta">Lo que debería haber en el cajón</label>
          <input
            className="campo tabular max-w-[180px]"
            value={teorico}
            onChange={(e) => setTeorico(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div data-guia="sim-contar">
          <label className="etiqueta">Cuenta el cajón</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {DENOMINACIONES.map((d) => (
              <div key={d}>
                <label className="mb-0.5 block text-xs text-slate-500">{eur(d)}</label>
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
        </div>

        <div data-guia="sim-resultado" className="rounded-lg bg-slate-50 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Debería haber</span>
            <span className="tabular font-semibold">{eur(teoricoCent)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Has contado</span>
            <span className="tabular font-semibold">{eur(contadoCent)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
            <span className="font-bold">Descuadre</span>
            <span
              className={`tabular text-lg font-bold ${
                !hayAlgo
                  ? 'text-slate-400'
                  : descuadre === 0
                    ? 'text-emerald-600'
                    : descuadre < 0
                      ? 'text-rose-600'
                      : 'text-amber-600'
              }`}
            >
              {descuadre > 0 ? '+' : ''}
              {eur(descuadre)}
            </span>
          </div>
        </div>

        {hayAlgo && (
          <Aviso tono={descuadre === 0 ? 'ok' : 'error'}>
            {descuadre === 0 ? (
              <>Cuadra. Así es como tiene que quedar.</>
            ) : descuadre < 0 ? (
              <>
                <strong>Falta {eur(Math.abs(descuadre))}.</strong> Suele ser un cambio mal dado o
                dinero que salió del cajón sin apuntarse. Revisa los movimientos antes de cerrar; si
                no aparece, se anota tal cual y se avisa al encargado.
              </>
            ) : (
              <>
                <strong>Sobran {eur(descuadre)}.</strong> Suele ser un cobro que no se registró, o
                cambio de menos a un cliente. Nunca te lo quedes ni lo saques: se anota igual.
              </>
            )}
          </Aviso>
        )}
      </div>
    </Modal>
  );
}
