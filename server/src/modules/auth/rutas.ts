import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { body } from '../../lib/http.js';
import { comparar, hashToken, requiereSesion } from '../../lib/auth.js';
import { noAutorizado } from '../../lib/errores.js';
import { auditar } from '../../lib/auditoria.js';
import { PERMISOS_POR_ROL, type Rol } from '../../types/dominio.js';

const DIAS_REFRESH = 7;

const zLoginPin = z.object({ pin: z.string().min(4).max(12) });
const zLoginPassword = z.object({ email: z.string().email(), password: z.string().min(4) });
const zRefresh = z.object({ refreshToken: z.string().min(10) });

async function emitirTokens(app: FastifyInstance, usuario: { id: string; nombre: string; rol: string }) {
  const accessToken = app.jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    { expiresIn: '12h' },
  );
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiraEn = new Date(Date.now() + DIAS_REFRESH * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { usuarioId: usuario.id, tokenHash: hashToken(refreshToken), expiraEn },
  });
  return { accessToken, refreshToken };
}

function perfil(u: { id: string; nombre: string; rol: string; color: string; email: string | null }) {
  return {
    id: u.id,
    nombre: u.nombre,
    rol: u.rol,
    color: u.color,
    email: u.email,
    permisos: PERMISOS_POR_ROL[u.rol as Rol] ?? [],
  };
}

export default async function rutasAuth(app: FastifyInstance) {
  /**
   * Login por PIN: el flujo normal en barra. Como el PIN es corto, se
   * compara contra todos los usuarios activos con bcrypt (no se puede
   * indexar un hash con sal). Con una plantilla de local es inmediato.
   */
  app.post('/login-pin', async (req) => {
    const { pin } = body(req, zLoginPin);
    const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
    for (const u of usuarios) {
      if (await comparar(pin, u.pinHash)) {
        const tokens = await emitirTokens(app, u);
        await auditar({ usuarioId: u.id, accion: 'LOGIN_PIN', entidad: 'Usuario', entidadId: u.id });
        return { ...tokens, usuario: perfil(u) };
      }
    }
    throw noAutorizado('PIN incorrecto');
  });

  /** Login por email + contraseña, para administración desde el despacho. */
  app.post('/login', async (req) => {
    const { email, password } = body(req, zLoginPassword);
    const u = await prisma.usuario.findUnique({ where: { email } });
    if (!u || !u.activo || !u.passwordHash) throw noAutorizado('Credenciales incorrectas');
    if (!(await comparar(password, u.passwordHash))) throw noAutorizado('Credenciales incorrectas');
    const tokens = await emitirTokens(app, u);
    await auditar({ usuarioId: u.id, accion: 'LOGIN', entidad: 'Usuario', entidadId: u.id });
    return { ...tokens, usuario: perfil(u) };
  });

  app.post('/refresh', async (req) => {
    const { refreshToken } = body(req, zRefresh);
    const guardado = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { usuario: true },
    });
    if (!guardado || guardado.revocadoEn || guardado.expiraEn < new Date() || !guardado.usuario.activo) {
      throw noAutorizado('Sesión caducada, vuelve a entrar');
    }
    await prisma.refreshToken.update({
      where: { id: guardado.id },
      data: { revocadoEn: new Date() },
    });
    const tokens = await emitirTokens(app, guardado.usuario);
    return { ...tokens, usuario: perfil(guardado.usuario) };
  });

  app.post('/logout', { preHandler: requiereSesion }, async (req) => {
    await prisma.refreshToken.updateMany({
      where: { usuarioId: req.usuario!.id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    return { ok: true };
  });

  app.get('/yo', { preHandler: requiereSesion }, async (req) => {
    const u = await prisma.usuario.findUnique({ where: { id: req.usuario!.id } });
    if (!u || !u.activo) throw noAutorizado('Usuario desactivado');
    return perfil(u);
  });
}
