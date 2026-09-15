import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { usePracticas } from '../lib/practicas';

/**
 * Franja permanente mientras se está practicando. Tiene que cantar: lo peor
 * que puede pasar es que alguien crea que está cobrando de verdad, o que un
 * pedido de prácticas se cuele en un servicio real.
 */
export default function BannerPracticas() {
  const { activo, desactivar } = usePracticas();
  const qc = useQueryClient();

  const { data } = useQuery<{ total: number }>({
    queryKey: ['formacion', 'practicas'],
    queryFn: () => api.get('/formacion/practicas'),
    enabled: activo,
    refetchInterval: 20_000,
  });

  const terminar = useMutation({
    mutationFn: () => api.del<{ ok: boolean }>('/formacion/practicas'),
    onSuccess: () => {
      desactivar();
      qc.invalidateQueries();
    },
  });

  if (!activo) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-violet-600 px-4 py-1.5 text-white">
      <p className="text-sm font-semibold">
        Modo prácticas
        <span className="ml-2 font-normal opacity-90">
          Nada de lo que hagas cuenta como venta ni emite factura
          {data && data.total > 0 && ` · ${data.total} pedido(s) de prueba`}
        </span>
      </p>
      <div className="flex gap-2">
        <button
          className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
          onClick={() => desactivar()}
        >
          Salir del modo prácticas
        </button>
        <button
          className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
          disabled={terminar.isPending}
          onClick={() => terminar.mutate()}
        >
          Terminar y borrar las pruebas
        </button>
      </div>
    </div>
  );
}
