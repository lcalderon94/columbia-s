import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { eur, aCentimos, fechaHora, ETIQUETA_ROL } from '../lib/formato';
import type { Categoria, Producto, UsuarioAdmin } from '../lib/tipos';
import { Cargando, Chip, Modal, Aviso } from '../components/ui';

type Pestana = 'usuarios' | 'carta' | 'local' | 'auditoria';

export default function Admin() {
  const puede = useSesion((s) => s.puede);
  const [pestana, setPestana] = useState<Pestana>('usuarios');

  const pestanas: { id: Pestana; texto: string; visible: boolean }[] = [
    { id: 'usuarios', texto: 'Usuarios y roles', visible: puede('usuarios.ver') },
    { id: 'carta', texto: 'Carta', visible: puede('carta.editar') },
    { id: 'local', texto: 'Datos del local', visible: puede('ajustes.editar') },
    { id: 'auditoria', texto: 'Auditoría', visible: puede('usuarios.ver') },
  ];

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex gap-1.5">
          {pestanas
            .filter((p) => p.visible)
            .map((p) => (
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

        {pestana === 'usuarios' && <Usuarios />}
        {pestana === 'carta' && <CartaAdmin />}
        {pestana === 'local' && <DatosLocal />}
        {pestana === 'auditoria' && <Auditoria />}
      </div>
    </div>
  );
}

function Usuarios() {
  const qc = useQueryClient();
  const puede = useSesion((s) => s.puede);
  const [editar, setEditar] = useState<UsuarioAdmin | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: usuarios, isLoading } = useQuery<UsuarioAdmin[]>({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios'),
  });
  const { data: roles } = useQuery<{ rol: string; permisos: string[] }[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/usuarios/roles'),
  });

  const refrescar = () => void qc.invalidateQueries({ queryKey: ['usuarios'] });

  const desactivar = useMutation({
    mutationFn: (id: string) => api.del(`/usuarios/${id}`),
    onSuccess: refrescar,
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'Error'),
  });

  if (isLoading) return <Cargando />;

  return (
    <div className="space-y-4">
      {error && <Aviso>{error}</Aviso>}
      <div className="tarjeta overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold text-slate-900">Equipo</h2>
          {puede('usuarios.gestionar') && (
            <button className="boton-primario" onClick={() => setNuevo(true)}>
              + Nuevo usuario
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Nombre</th>
              <th>Rol</th>
              <th>Email</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(usuarios ?? []).map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'opacity-50'}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.nombre.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-medium text-slate-800">{u.nombre}</span>
                  </span>
                </td>
                <td className="text-slate-600">{ETIQUETA_ROL[u.rol] ?? u.rol}</td>
                <td className="text-slate-500">{u.email ?? '—'}</td>
                <td>
                  <span className={`chip ${u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {u.activo ? 'Activo' : 'Baja'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {puede('usuarios.gestionar') && (
                    <span className="flex justify-end gap-1.5">
                      <button className="boton-secundario px-2 py-1 text-xs" onClick={() => setEditar(u)}>
                        Editar
                      </button>
                      {u.activo && (
                        <button
                          className="boton-secundario px-2 py-1 text-xs text-rose-600"
                          onClick={() => desactivar.mutate(u.id)}
                        >
                          Dar de baja
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tarjeta p-4">
        <h2 className="mb-3 font-bold text-slate-900">Qué puede hacer cada rol</h2>
        <div className="space-y-3">
          {(roles ?? []).map((r) => (
            <div key={r.rol}>
              <p className="text-sm font-semibold text-slate-800">{ETIQUETA_ROL[r.rol] ?? r.rol}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.permisos.map((p) => (
                  <span key={p} className="chip bg-slate-100 text-slate-600">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(nuevo || editar) && (
        <FormularioUsuario
          usuario={editar}
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

function FormularioUsuario({
  usuario,
  onCerrar,
  onGuardado,
}: {
  usuario: UsuarioAdmin | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState({
    nombre: usuario?.nombre ?? '',
    email: usuario?.email ?? '',
    rol: usuario?.rol ?? 'CAMARERO',
    color: usuario?.color ?? '#2563eb',
    pin: '',
    password: '',
    activo: usuario?.activo ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo: Record<string, unknown> = {
        nombre: form.nombre,
        email: form.email || null,
        rol: form.rol,
        color: form.color,
      };
      if (form.pin) cuerpo.pin = form.pin;
      if (form.password) cuerpo.password = form.password;
      if (usuario) cuerpo.activo = form.activo;
      return usuario ? api.patch(`/usuarios/${usuario.id}`, cuerpo) : api.post('/usuarios', cuerpo);
    },
    onSuccess: onGuardado,
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar'),
  });

  return (
    <Modal
      abierto
      titulo={usuario ? `Editar ${usuario.nombre}` : 'Nuevo usuario'}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className="boton-primario"
            disabled={!form.nombre.trim() || (!usuario && !form.pin) || guardar.isPending}
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
          <input className="campo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiqueta">Rol</label>
            <select className="campo" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              {Object.entries(ETIQUETA_ROL).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta">Color</label>
            <input
              type="color"
              className="campo h-[38px] p-1"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="etiqueta">PIN {usuario && '(dejar vacío para no cambiarlo)'}</label>
          <input
            className="campo tabular"
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
            placeholder="4 a 8 dígitos"
            inputMode="numeric"
          />
          <p className="mt-1 text-xs text-slate-500">
            Cada PIN debe ser único: es lo que identifica a la persona al entrar en barra.
          </p>
        </div>
        <div>
          <label className="etiqueta">Email (opcional, para entrar con contraseña)</label>
          <input className="campo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        {form.email && (
          <div>
            <label className="etiqueta">Contraseña {usuario && '(vacío = sin cambios)'}</label>
            <input
              className="campo"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        )}
        {usuario && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-marca-600"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
            <span className="text-sm text-slate-700">Usuario activo</span>
          </label>
        )}
      </div>
    </Modal>
  );
}

function CartaAdmin() {
  const qc = useQueryClient();
  const [editar, setEditar] = useState<Producto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: carta, isLoading } = useQuery<Categoria[]>({
    queryKey: ['carta', 'admin'],
    queryFn: () => api.get('/carta?incluirInactivos=true'),
  });

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ['carta'] });
  };

  if (isLoading) return <Cargando />;

  return (
    <div className="space-y-4">
      {error && <Aviso>{error}</Aviso>}
      <Aviso tono="info">
        Al cambiar un precio solo afecta a los pedidos nuevos: las líneas ya comandadas conservan el
        precio con el que se tomaron.
      </Aviso>
      {(carta ?? []).map((c) => (
        <div key={c.id} className="tarjeta overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ backgroundColor: `${c.color}15` }}
          >
            <h2 className="font-bold text-slate-900">
              {c.nombre}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {c.destino === 'NINGUNO' ? 'no pasa por cocina' : `va a ${c.destino.toLowerCase()}`}
              </span>
            </h2>
            <span className="text-sm text-slate-500">{c.productos.length} productos</span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {c.productos.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-800">{p.nombre}</span>
                    <span className="ml-1.5">
                      {p.vegano && '🌱'}
                      {p.picante && '🌶️'}
                      {p.kids && '🧒'}
                    </span>
                    {p.alergenos.length > 0 && (
                      <p className="text-[11px] text-slate-400">
                        {p.alergenos.map((a) => a.nombre).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="tabular w-24 text-right font-semibold">{eur(p.precioCent)}</td>
                  <td className="w-16 text-right text-xs text-slate-500">IVA {p.ivaTipo}%</td>
                  <td className="w-28 px-4 py-2 text-right">
                    <button className="boton-secundario px-2 py-1 text-xs" onClick={() => setEditar(p)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {editar && (
        <FormularioProducto
          producto={editar}
          onCerrar={() => setEditar(null)}
          onGuardado={() => {
            setEditar(null);
            refrescar();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function FormularioProducto({
  producto,
  onCerrar,
  onGuardado,
  onError,
}: {
  producto: Producto;
  onCerrar: () => void;
  onGuardado: () => void;
  onError: (e: string) => void;
}) {
  const [form, setForm] = useState({
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? '',
    precio: String(producto.precioCent / 100).replace('.', ','),
    ivaTipo: producto.ivaTipo,
    activo: producto.activo,
    vegano: producto.vegano,
    picante: producto.picante,
    kids: producto.kids,
  });

  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/carta/productos/${producto.id}`, {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        precioCent: aCentimos(form.precio),
        ivaTipo: form.ivaTipo,
        activo: form.activo,
        vegano: form.vegano,
        picante: form.picante,
        kids: form.kids,
      }),
    onSuccess: onGuardado,
    onError: (e) => onError(e instanceof ErrorApi ? e.message : 'No se pudo guardar'),
  });

  return (
    <Modal
      abierto
      titulo={`Editar ${producto.nombre}`}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="boton-primario" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="etiqueta">Nombre</label>
          <input className="campo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div>
          <label className="etiqueta">Descripción</label>
          <textarea
            className="campo"
            rows={3}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiqueta">Precio</label>
            <input
              className="campo tabular"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="etiqueta">IVA</label>
            <select
              className="campo"
              value={form.ivaTipo}
              onChange={(e) => setForm({ ...form, ivaTipo: Number(e.target.value) })}
            >
              {[0, 4, 10, 21].map((v) => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['activo', 'En carta'],
              ['vegano', 'Vegano'],
              ['picante', 'Picante'],
              ['kids', 'Para niños'],
            ] as const
          ).map(([clave, texto]) => (
            <label key={clave} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-marca-600"
                checked={form[clave]}
                onChange={(e) => setForm({ ...form, [clave]: e.target.checked })}
              />
              <span className="text-sm text-slate-700">{texto}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function DatosLocal() {
  const qc = useQueryClient();
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: ajustes, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['ajustes'],
    queryFn: () => api.get('/informes/ajustes'),
  });
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const valores = form ?? ajustes ?? {};

  const guardar = useMutation({
    mutationFn: () => api.put('/informes/ajustes', valores),
    onSuccess: () => {
      setGuardado(true);
      void qc.invalidateQueries({ queryKey: ['ajustes'] });
      setTimeout(() => setGuardado(false), 2500);
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar'),
  });

  if (isLoading) return <Cargando />;

  const campos: [string, string][] = [
    ['local.nombre', 'Nombre comercial'],
    ['local.razonSocial', 'Razón social'],
    ['local.nif', 'NIF / CIF'],
    ['local.direccion', 'Dirección'],
    ['local.cp', 'Código postal'],
    ['local.ciudad', 'Ciudad'],
    ['local.telefono', 'Teléfono'],
    ['local.email', 'Email'],
  ];

  return (
    <div className="tarjeta p-4">
      <h2 className="mb-1 font-bold text-slate-900">Datos fiscales del local</h2>
      <p className="mb-4 text-sm text-slate-500">
        Es lo que sale impreso en cada recibo y factura.
      </p>
      {error && <div className="mb-3"><Aviso>{error}</Aviso></div>}
      {guardado && <div className="mb-3"><Aviso tono="ok">Datos guardados.</Aviso></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map(([clave, texto]) => (
          <div key={clave}>
            <label className="etiqueta">{texto}</label>
            <input
              className="campo"
              value={valores[clave] ?? ''}
              onChange={(e) => setForm({ ...valores, [clave]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <Aviso tono="info">
        El NIF queda congelado en cada factura al emitirla, así que cambiarlo aquí no rompe la
        verificación de las facturas ya emitidas.
      </Aviso>
      <button className="boton-primario mt-4" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
        Guardar datos
      </button>
    </div>
  );
}

function Auditoria() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['auditoria'],
    queryFn: () => api.get('/usuarios/auditoria?limite=200'),
  });

  if (isLoading) return <Cargando />;

  return (
    <div className="tarjeta overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-bold text-slate-900">Registro de acciones sensibles</h2>
        <p className="text-sm text-slate-500">
          Anulaciones, descuentos, invitaciones, cambios de precio y movimientos de caja.
        </p>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Cuándo</th>
              <th>Quién</th>
              <th>Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-1.5 text-slate-500">{fechaHora(a.creadoEn)}</td>
                <td className="whitespace-nowrap text-slate-700">{a.usuario?.nombre ?? '—'}</td>
                <td>
                  <Chip estado={a.accion} texto={a.accion} />
                </td>
                <td className="px-4 py-1.5 font-mono text-[11px] text-slate-500">
                  {a.detalle ? JSON.stringify(a.detalle) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
