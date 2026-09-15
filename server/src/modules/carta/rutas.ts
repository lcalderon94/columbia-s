import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { body, params, query, zId } from '../../lib/http.js';
import { requierePermiso } from '../../lib/auth.js';
import { noEncontrado, conflicto } from '../../lib/errores.js';
import { auditar } from '../../lib/auditoria.js';
import { zDestino, zIva } from '../../types/dominio.js';

const zCategoria = z.object({
  nombre: z.string().min(2),
  orden: z.number().int().default(0),
  destino: zDestino.default('COCINA'),
  color: z.string().default('#0ea5e9'),
  activa: z.boolean().default(true),
});

const zProducto = z.object({
  categoriaId: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  precioCent: z.number().int().min(0),
  ivaTipo: zIva.default(10),
  destino: zDestino.optional().nullable(),
  tipo: z.enum(['NORMAL', 'COVER']).default('NORMAL'),
  vegano: z.boolean().default(false),
  picante: z.boolean().default(false),
  kids: z.boolean().default(false),
  sinGlutenDisponible: z.boolean().default(false),
  activo: z.boolean().default(true),
  orden: z.number().int().default(0),
  codigoRapido: z.string().optional().nullable(),
  alergenos: z.array(z.string()).default([]),
  gruposModificador: z.array(z.string()).default([]),
});

const zGrupo = z.object({
  nombre: z.string().min(1),
  min: z.number().int().min(0).default(0),
  max: z.number().int().min(1).default(1),
  orden: z.number().int().default(0),
  modificadores: z
    .array(
      z.object({
        id: z.string().optional(),
        nombre: z.string().min(1),
        precioCent: z.number().int().default(0),
        orden: z.number().int().default(0),
        activo: z.boolean().default(true),
      }),
    )
    .default([]),
});

const incluirProducto = {
  alergenos: { include: { alergeno: true } },
  gruposModificador: {
    include: { grupo: { include: { modificadores: { orderBy: { orden: 'asc' as const } } } } },
    orderBy: { orden: 'asc' as const },
  },
};

function mapearProducto(p: any) {
  return {
    id: p.id,
    categoriaId: p.categoriaId,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precioCent: p.precioCent,
    ivaTipo: p.ivaTipo,
    destino: p.destino,
    tipo: p.tipo,
    vegano: p.vegano,
    picante: p.picante,
    kids: p.kids,
    sinGlutenDisponible: p.sinGlutenDisponible,
    activo: p.activo,
    orden: p.orden,
    codigoRapido: p.codigoRapido,
    alergenos: (p.alergenos ?? []).map((a: any) => ({ id: a.alergeno.id, nombre: a.alergeno.nombre })),
    gruposModificador: (p.gruposModificador ?? []).map((g: any) => ({
      id: g.grupo.id,
      nombre: g.grupo.nombre,
      min: g.grupo.min,
      max: g.grupo.max,
      modificadores: g.grupo.modificadores.filter((m: any) => m.activo),
    })),
  };
}

export default async function rutasCarta(app: FastifyInstance) {
  // -- Carta completa: lo que consume la pantalla del TPV -------------------
  app.get('/', { preHandler: requierePermiso('carta.ver') }, async (req) => {
    const q = query(req, z.object({ incluirInactivos: z.coerce.boolean().default(false) }));
    const categorias = await prisma.categoria.findMany({
      where: q.incluirInactivos ? {} : { activa: true },
      orderBy: { orden: 'asc' },
      include: {
        productos: {
          where: q.incluirInactivos ? {} : { activo: true },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
          include: incluirProducto,
        },
      },
    });
    return categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      orden: c.orden,
      destino: c.destino,
      color: c.color,
      activa: c.activa,
      productos: c.productos.map(mapearProducto),
    }));
  });

  app.get('/alergenos', { preHandler: requierePermiso('carta.ver') }, async () => {
    return prisma.alergeno.findMany({ orderBy: { nombre: 'asc' } });
  });

  // -- Categorias -----------------------------------------------------------
  app.post('/categorias', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const datos = body(req, zCategoria);
    const existe = await prisma.categoria.findUnique({ where: { nombre: datos.nombre } });
    if (existe) throw conflicto('Ya existe una categoría con ese nombre');
    const creada = await prisma.categoria.create({ data: datos });
    await auditar({ usuarioId: req.usuario!.id, accion: 'CATEGORIA_CREADA', entidad: 'Categoria', entidadId: creada.id });
    return creada;
  });

  app.patch('/categorias/:id', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(req, zCategoria.partial());
    const existe = await prisma.categoria.findUnique({ where: { id } });
    if (!existe) throw noEncontrado('Categoría');
    return prisma.categoria.update({ where: { id }, data: datos });
  });

  app.delete('/categorias/:id', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const { id } = params(req, zId);
    const conProductos = await prisma.producto.count({ where: { categoriaId: id } });
    if (conProductos > 0) {
      // No se borra: se archiva junto con sus productos, para no romper el historico.
      await prisma.categoria.update({ where: { id }, data: { activa: false } });
      await prisma.producto.updateMany({ where: { categoriaId: id }, data: { activo: false } });
      return { ok: true, archivada: true };
    }
    await prisma.categoria.delete({ where: { id } });
    return { ok: true, archivada: false };
  });

  // -- Productos ------------------------------------------------------------
  app.get('/productos/:id', { preHandler: requierePermiso('carta.ver') }, async (req) => {
    const { id } = params(req, zId);
    const p = await prisma.producto.findUnique({ where: { id }, include: incluirProducto });
    if (!p) throw noEncontrado('Producto');
    return mapearProducto(p);
  });

  app.post('/productos', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const datos = body(req, zProducto);
    const { alergenos, gruposModificador, ...resto } = datos;
    const creado = await prisma.producto.create({
      data: {
        ...resto,
        alergenos: { create: alergenos.map((alergenoId) => ({ alergenoId })) },
        gruposModificador: {
          create: gruposModificador.map((grupoId, i) => ({ grupoId, orden: i })),
        },
      },
      include: incluirProducto,
    });
    await auditar({
      usuarioId: req.usuario!.id,
      accion: 'PRODUCTO_CREADO',
      entidad: 'Producto',
      entidadId: creado.id,
      detalle: { nombre: creado.nombre, precioCent: creado.precioCent },
    });
    return mapearProducto(creado);
  });

  app.patch('/productos/:id', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(req, zProducto.partial());
    const anterior = await prisma.producto.findUnique({ where: { id } });
    if (!anterior) throw noEncontrado('Producto');
    const { alergenos, gruposModificador, ...resto } = datos;

    const actualizado = await prisma.$transaction(async (tx) => {
      if (alergenos) {
        await tx.productoAlergeno.deleteMany({ where: { productoId: id } });
        if (alergenos.length) {
          await tx.productoAlergeno.createMany({
            data: alergenos.map((alergenoId) => ({ productoId: id, alergenoId })),
          });
        }
      }
      if (gruposModificador) {
        await tx.grupoModificadorProducto.deleteMany({ where: { productoId: id } });
        if (gruposModificador.length) {
          await tx.grupoModificadorProducto.createMany({
            data: gruposModificador.map((grupoId, i) => ({ productoId: id, grupoId, orden: i })),
          });
        }
      }
      return tx.producto.update({ where: { id }, data: resto, include: incluirProducto });
    });

    if (datos.precioCent !== undefined && datos.precioCent !== anterior.precioCent) {
      await auditar({
        usuarioId: req.usuario!.id,
        accion: 'PRECIO_CAMBIADO',
        entidad: 'Producto',
        entidadId: id,
        detalle: { de: anterior.precioCent, a: datos.precioCent },
      });
    }
    return mapearProducto(actualizado);
  });

  app.delete('/productos/:id', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const { id } = params(req, zId);
    // Baja logica siempre: hay lineas de pedido historicas apuntando aqui.
    await prisma.producto.update({ where: { id }, data: { activo: false } });
    await auditar({ usuarioId: req.usuario!.id, accion: 'PRODUCTO_ARCHIVADO', entidad: 'Producto', entidadId: id });
    return { ok: true };
  });

  // -- Grupos de modificadores ---------------------------------------------
  app.get('/modificadores', { preHandler: requierePermiso('carta.ver') }, async () => {
    return prisma.grupoModificador.findMany({
      orderBy: { orden: 'asc' },
      include: { modificadores: { orderBy: { orden: 'asc' } } },
    });
  });

  app.post('/modificadores', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const datos = body(req, zGrupo);
    return prisma.grupoModificador.create({
      data: {
        nombre: datos.nombre,
        min: datos.min,
        max: datos.max,
        orden: datos.orden,
        modificadores: { create: datos.modificadores.map(({ id: _id, ...m }) => m) },
      },
      include: { modificadores: true },
    });
  });

  app.patch('/modificadores/:id', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const { id } = params(req, zId);
    const datos = body(req, zGrupo.partial());
    const grupo = await prisma.grupoModificador.findUnique({ where: { id } });
    if (!grupo) throw noEncontrado('Grupo de modificadores');
    return prisma.$transaction(async (tx) => {
      if (datos.modificadores) {
        await tx.modificador.deleteMany({ where: { grupoId: id } });
        await tx.modificador.createMany({
          data: datos.modificadores.map(({ id: _id, ...m }) => ({ ...m, grupoId: id })),
        });
      }
      return tx.grupoModificador.update({
        where: { id },
        data: { nombre: datos.nombre, min: datos.min, max: datos.max, orden: datos.orden },
        include: { modificadores: { orderBy: { orden: 'asc' } } },
      });
    });
  });

  app.delete('/modificadores/:id', { preHandler: requierePermiso('carta.editar') }, async (req) => {
    const { id } = params(req, zId);
    await prisma.grupoModificador.delete({ where: { id } });
    return { ok: true };
  });
}
