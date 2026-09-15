import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { rutaInicial, useSesion, type Usuario } from '../lib/sesion';
import { TecladoNumerico, Aviso } from '../components/ui';

export default function Login() {
  const { usuario, entrar } = useSesion();
  const navegar = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [modoEmail, setModoEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (usuario) return <Navigate to={rutaInicial(usuario.rol)} replace />;

  const acceder = async (cuerpo: unknown, url: string) => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api${url}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error ?? 'No se pudo entrar');
      entrar(datos as { accessToken: string; refreshToken: string; usuario: Usuario });
      navegar(rutaInicial(datos.usuario.rol), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar');
      setPin('');
    } finally {
      setCargando(false);
    }
  };

  const pulsar = (d: string) => {
    if (pin.length >= 8) return;
    const nuevo = pin + d;
    setPin(nuevo);
    setError(null);
    // Con 4 dígitos ya se intenta: es el largo habitual del PIN de barra.
    if (nuevo.length === 4) void acceder({ pin: nuevo }, '/auth/login-pin');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-marca-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Columbia<span className="text-marca-400">'s</span>
          </h1>
          <p className="mt-1 text-sm uppercase tracking-[0.25em] text-marca-400">Board Game Café</p>
        </div>

        <div className="tarjeta p-5">
          {modoEmail ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void acceder({ email, password }, '/auth/login');
              }}
            >
              <div>
                <label className="etiqueta">Email</label>
                <input
                  className="campo"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="etiqueta">Contraseña</label>
                <input
                  className="campo"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <Aviso>{error}</Aviso>}
              <button className="boton-primario w-full" disabled={cargando}>
                {cargando ? 'Entrando…' : 'Entrar'}
              </button>
              <button
                type="button"
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setModoEmail(false);
                  setError(null);
                }}
              >
                Entrar con PIN
              </button>
            </form>
          ) : (
            <>
              <p className="mb-3 text-center text-sm font-medium text-slate-600">
                Introduce tu PIN
              </p>
              <div className="mb-4 flex justify-center gap-2">
                {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
                  <span
                    key={i}
                    className={`h-3.5 w-3.5 rounded-full transition ${
                      i < pin.length ? 'bg-marca-600' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              {error && <div className="mb-3"><Aviso>{error}</Aviso></div>}
              <TecladoNumerico
                onTecla={pulsar}
                onBorrar={() => setPin((p) => p.slice(0, -1))}
                onLimpiar={() => setPin('')}
              />
              {pin.length > 4 && (
                <button
                  className="boton-primario mt-3 w-full"
                  disabled={cargando}
                  onClick={() => void acceder({ pin }, '/auth/login-pin')}
                >
                  Entrar
                </button>
              )}
              <button
                className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setModoEmail(true);
                  setError(null);
                }}
              >
                Entrar con email y contraseña
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
