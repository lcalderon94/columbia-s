import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion, rutaInicial } from './lib/sesion';
import Marco from './components/Marco';
import Login from './pages/Login';
import Sala from './pages/Sala';
import Pedido from './pages/Pedido';
import Cobro from './pages/Cobro';
import Cocina from './pages/Cocina';
import Reservas from './pages/Reservas';
import Juegos from './pages/Juegos';
import Caja from './pages/Caja';
import Facturas from './pages/Facturas';
import Informes from './pages/Informes';
import Admin from './pages/Admin';
import Formacion from './pages/Formacion';

/** Envuelve una ruta que exige sesión y, opcionalmente, un permiso. */
function Privada({ permiso, children }: { permiso?: string; children: React.ReactNode }) {
  const { usuario, puede } = useSesion();
  if (!usuario) return <Navigate to="/entrar" replace />;
  if (permiso && !puede(permiso)) return <Navigate to={rutaInicial(usuario.rol)} replace />;
  return <Marco>{children}</Marco>;
}

export default function App() {
  const usuario = useSesion((s) => s.usuario);

  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route
        path="/"
        element={<Navigate to={usuario ? rutaInicial(usuario.rol) : '/entrar'} replace />}
      />
      <Route path="/sala" element={<Privada permiso="sala.ver"><Sala /></Privada>} />
      <Route path="/pedido/:id" element={<Privada permiso="pedidos.ver"><Pedido /></Privada>} />
      <Route path="/cobro/:id" element={<Privada permiso="cobro.realizar"><Cobro /></Privada>} />
      <Route path="/cocina" element={<Privada permiso="cocina.ver"><Cocina destino="COCINA" /></Privada>} />
      <Route path="/barra" element={<Privada permiso="cocina.ver"><Cocina destino="BARRA" /></Privada>} />
      <Route path="/reservas" element={<Privada permiso="reservas.ver"><Reservas /></Privada>} />
      <Route path="/juegos" element={<Privada permiso="juegos.ver"><Juegos /></Privada>} />
      <Route path="/caja" element={<Privada permiso="caja.ver"><Caja /></Privada>} />
      <Route path="/facturas" element={<Privada permiso="factura.emitir"><Facturas /></Privada>} />
      <Route path="/informes" element={<Privada permiso="informes.ver"><Informes /></Privada>} />
      <Route path="/formacion" element={<Privada permiso="carta.ver"><Formacion /></Privada>} />
      <Route path="/admin" element={<Privada permiso="usuarios.ver"><Admin /></Privada>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
