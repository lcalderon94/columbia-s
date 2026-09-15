import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { body, params, zId } from '../../lib/http.js';
import { hashear, requierePermiso } from '../../lib/auth.js';
import { conflicto, invalido, noEncontrado } from '../../lib/errores.js';
import { auditar } from '../../lib/auditoria.js';
import { PERMISOS_POR_ROL, zRol, type Rol } from '../../types/dominio.js';

const zCrear = z.object({
  nombre: z.string().min(2),
  email: z.string().email().optional().nullable(),
  pin: z.string().regex(/^\d{4,8}$/, 'El PIN debe tener entre 4 y 8 dígitos'),
  password: z.string().min(6).optional().nullable(),
  rol: zRol,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const zEditar = zCrear.partial().extend({ activo: z.boolean().optional() });

const publico = (u: any) => ({
  id: u.id,
  nombre: u.nombre,
  email: u.email,
  rol: u.rol,
  color: u.color,
  activo: u.activo,
  creadoEn: u.creadoEn,
});

/** Un PIN repetido rompe el login por PIN, asi que se comprueba antes. */
async function pinYaUsado(pin: string, excluirId?: string): Promise<boolean> {
  const { comparar } = await import('../../lib/auth.js');
  const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
  for (const u of usuarios) {
    if (u.id === excluirId) continue;
    if (await comparar(pin, u.pinHash)) return true;
  }
  return false;
}

export default async function rutasUsuarios(app: FastifyInstance) {
  app.get('/', { preHandler: requierePermiso('usuarios.ver') }, async () => {
    const lista = await prisma.usuario.findMany({ orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] });
    return lista.map(publico);
  });

  app.get('/roles', { preHandler: requierePermiso('usuarios.ver') }, async () => {
    return Object.entries(PERMISOS_POR_ROL).map(([rol, permisos]) => ({ rol, permisos }));
  });

  app.post('/', { preHandler: requierePermiso('usuarios.gestionar') }, async (req) => {
    const datos = body(req, zCrear);
    if (datos.email) {
      const existe = await prisma.usuario.findUnique({ where: { email: datos.email } });
      if (existe) throw conflicto('Ya hay un usuario con ese email');
    }
    if (await pinYaUsado(datos.pin)) throw conflicto('Ese PIN ya está en uso por otro usuario');

    const creado = await prisma.usuario.create({
      data: {
        nombre: datos.nombre,
        email: datos.email ?? null,
        rol: datos.rol,
        color: datos.color ?? '#2563eb',
        pinHash: await hashear(datos.pin),
        passwordHash: datos.password ? await hashear(datos.password) : null,
      },
    });
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'USUARIO_CREADO',
      entidad: 'Usuario',
      entidadId: creado.id,
      detalle: { nombre: creado.nombre, rol: creado.rol },
    });
    return publico(creado);
  });

  app.patch('/:id', { preHandler: requierePermiso('usuarios.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(req, zEditar);
    const actual = await prisma.usuario.findUnique({ where: { id } });
    if (!actual) throw noEncontrado('Usuario');

    if (datos.pin && (await pinYaUsado(datos.pin, id))) {
      throw conflicto('Ese PIN ya está en uso por otro usuario');
    }
    // No dejamos al local sin ningun administrador operativo.
    if ((datos.activo === false || (datos.rol && datos.rol !== 'ADMIN')) && actual.rol === 'ADMIN') {
      const admins = await prisma.usuario.count({ where: { rol: 'ADMIN', activo: true } });
      if (admins <= 1) throw invalido('Debe quedar al menos un administrador activo');
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        email: datos.email === undefined ? undefined : datos.email,
        rol: datos.rol as Rol | undefined,
        color: datos.color,
        activo: datos.activo,
        pinHash: datos.pin ? await hashear(datos.pin) : undefined,
        passwordHash: datos.password ? await hashear(datos.password) : undefined,
      },
    });
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'USUARIO_EDITADO',
      entidad: 'Usuario',
      entidadId: id,
      detalle: { cambios: Object.keys(datos) },
    });
    return publico(actualizado);
  });

  app.delete('/:id', { preHandler: requierePermiso('usuarios.gestionar') }, async (req) => {
    const { id } = params(req, zId);
    const u = await prisma.usuario.findUnique({ where: { id } });
    if (!u) throw noEncontrado('Usuario');
    if (u.rol === 'ADMIN') {
      const admins = await prisma.usuario.count({ where: { rol: 'ADMIN', activo: true } });
      if (admins <= 1) throw invalido('Debe quedar al menos un administrador activo');
    }
    // Baja logica: el historico de pedidos y cobros debe seguir apuntando a el.
    await prisma.usuario.update({ where: { id }, data: { activo: false } });
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'USUARIO_DESACTIVADO',
      entidad: 'Usuario',
      entidadId: id,
    });
    return { ok: true };
  });

  app.get('/auditoria', { preHandler: requierePermiso('usuarios.ver') }, async (req) => {
    const q = z
      .object({ limite: z.coerce.number().min(1).max(500).default(100) })
      .parse(req.query ?? {});
    const registros = await prisma.registroAuditoria.findMany({
      orderBy: { creadoEn: 'desc' },
      take: q.limite,
      include: { usuario: { select: { nombre: true, rol: true } } },
    });
    return registros.map((r) => ({ ...r, detalle: r.detalle ? JSON.parse(r.detalle) : null }));
  });
}
