import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { usePracticas } from '../lib/practicas';
import { hayGuiaActiva } from '../lib/tour';
import { Modal } from './ui';

interface Progreso {
  listo: boolean;
  completadas: number;
  total: number;
  guias: { id: string; esencial: boolean; completada: boolean }[];
}

const CLAVE_POSPUESTO = 'columbias-bienvenida-pospuesta';

/**
 * Recibimiento para quien entra por primera vez. Solo aparece si le faltan
 * las guías que tocan dinero, y solo una vez por sesión: si lo aparta, no
 * vuelve a molestar hasta el siguiente turno.
 */
export default function Bienvenida() {
  const usuario = useSesion((s) => s.usuario);
  const enPracticas = usePracticas((s) => s.activo);
  const navegar = useNavigate();
  const [visible, setVisible] = useState(false);

  const { data } = useQuery<Progreso>({
    queryKey: ['formacion'],
    queryFn: () => api.get('/formacion'),
    enabled: !!usuario,
  });

  useEffect(() => {
    if (!data || !usuario) return;
    if (data.listo) return;
    // Nunca encima de una guía en marcha ni durante las prácticas: taparía
    // justo lo que el empleado tiene que estar mirando.
    if (hayGuiaActiva() || enPracticas) return;
    if (sessionStorage.getItem(`${CLAVE_POSPUESTO}-${usuario.id}`)) return;

    // Se marca al enseñarlo, no al cerrarlo: si no, volvía a salir en cada
    // cambio de pantalla y dejaba la aplicación bloqueada.
    sessionStorage.setItem(`${CLAVE_POSPUESTO}-${usuario.id}`, '1');
    setVisible(true);
  }, [data, usuario, enPracticas]);

  const apartar = () => setVisible(false);

  if (!data) return null;

  const faltan = data.guias.filter((g) => g.esencial && !g.completada).length;
  const empezado = data.completadas > 0;

  return (
    <Modal
      abierto={visible}
      titulo={empezado ? 'Te quedan guías por hacer' : `Bienvenido, ${usuario?.nombre ?? ''}`}
      onCerrar={apartar}
      pie={
        <>
          <button className="boton-secundario" onClick={apartar}>
            Ahora no
          </button>
          <button
            className="boton-primario"
            onClick={() => {
              apartar();
              navegar('/formacion');
            }}
          >
            {empezado ? 'Seguir con la formación' : 'Empezar'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {empezado ? (
            <>
              Llevas <strong>{data.completadas} de {data.total}</strong> guías. Te faltan{' '}
              <strong>{faltan}</strong> de las imprescindibles.
            </>
          ) : (
            <>
              Antes de tu primer turno hay unas guías cortas que te llevan por el programa señalando
              cada botón. Son unos minutos y se practican sin cobrar dinero de verdad.
            </>
          )}
        </p>

        <ul className="space-y-1.5 text-sm">
          {[
            ['Tomar una comanda', 'Añadir bebida y comida y mandarla a cocina'],
            ['Cobrar una cuenta', 'Efectivo, tarjeta, pago mixto y cuándo hace falta factura'],
            ['Abrir la caja', 'Lo primero del turno'],
            ['Cerrar la caja', 'Contar el cajón y entender el descuadre'],
          ].map(([titulo, texto]) => (
            <li key={titulo} className="flex gap-2">
              <span className="text-marca-600">•</span>
              <span>
                <strong className="text-slate-800">{titulo}</strong>
                <span className="text-slate-500"> — {texto}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Lo que hagas practicando no cuenta como venta, no emite ninguna factura y se borra al
          terminar. Puedes equivocarte tranquilo.
        </p>
      </div>
    </Modal>
  );
}
