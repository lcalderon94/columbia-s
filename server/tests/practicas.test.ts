import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { api, arrancarApp, entrar } from './ayudas.js';

/**
 * Lo que un empleado hace mientras aprende no puede tocar la contabilidad.
 * Un número de factura no se puede devolver, así que si unas prácticas
 * llegaran a consumir uno, borrarlas dejaría un hueco en la numeración y
 * rompería la cadena de huellas.
 */
describe('las prácticas no contaminan nada', () => {
  let app: FastifyInstance;
  let admin: ReturnType<typeof api>;
  let pedidoPracticaId: string;
  let mesaId: string;
  let facturaRealCodigo: string;
  /** Foto de los informes justo antes de cobrar las prácticas. */
  let ventaAntesCent = 0;
  let productosAntesCent = 0;

  beforeAll(async () => {
    app = await arrancarApp();
    admin = api(app, await entrar(app, '1111'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('parte de una caja abierta y sin ventas de prácticas', async () => {
    const abierta = (await admin.get('/api/caja/actual')).json();
    if (!abierta) {
      const r = await admin.post('/api/caja/abrir', { saldoInicialCent: 10000 });
      expect(r.statusCode).toBe(200);
    }
  });

  it('crea un pedido marcado como prácticas', async () => {
    const sala = (await admin.get('/api/sala')).json();
    const libre = sala.zonas.flatMap((z: any) => z.mesas).find((m: any) => m.estado === 'LIBRE');
    mesaId = libre.id;

    const r = await admin.post('/api/pedidos', {
      tipo: 'MESA',
      mesaId,
      comensales: 2,
      esPractica: true,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().esPractica).toBe(true);
    pedidoPracticaId = r.json().id;
  });

  it('se comanda igual que un pedido real', async () => {
    const carta = (await admin.get('/api/carta')).json();
    const burger = carta
      .find((c: any) => c.nombre === 'Hamburguesas')
      .productos.find((p: any) => p.nombre === "Columbia's Classic");

    const r = await admin.post(`/api/pedidos/${pedidoPracticaId}/lineas`, {
      lineas: [{ productoId: burger.id, cantidad: 1 }],
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().totales.totalCent).toBe(1250);

    const enviado = await admin.post(`/api/pedidos/${pedidoPracticaId}/enviar`);
    expect(enviado.statusCode).toBe(200);
  });

  it('cobrar en prácticas NO emite factura ni consume número de serie', async () => {
    const antesFacturas = (await admin.get('/api/cobros/facturas')).json().length;
    const serieAntes = await obtenerSiguienteNumeroSerie(app);

    ventaAntesCent = (await admin.get('/api/informes/hoy')).json().ventaCent;
    productosAntesCent = (await admin.get('/api/informes/productos'))
      .json()
      .productos.reduce((a: number, p: any) => a + p.importeCent, 0);

    const cuenta = (await admin.get(`/api/cobros/pedido/${pedidoPracticaId}/cuenta`)).json();
    const r = await admin.post(`/api/cobros/pedido/${pedidoPracticaId}/cobrar`, {
      pagos: [{ metodo: 'EFECTIVO', importeCent: cuenta.pendienteCent, entregadoCent: 2000 }],
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().esPractica).toBe(true);
    expect(r.json().factura).toBeNull();
    expect(r.json().pedido.estado).toBe('COBRADO');

    const despuesFacturas = (await admin.get('/api/cobros/facturas')).json().length;
    expect(despuesFacturas).toBe(antesFacturas);
    expect(await obtenerSiguienteNumeroSerie(app)).toBe(serieAntes);
  });

  it('el recibo de prácticas sale marcado y sin huella', async () => {
    const r = await admin.get(`/api/cobros/pedido/${pedidoPracticaId}/recibo-practica`);
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('SIN VALIDEZ');
    expect(r.body).toContain('SIN HUELLA');
  });

  it('el cobro de prácticas no entra en la caja', async () => {
    const caja = (await admin.get('/api/caja/actual')).json();
    const movimientosPractica = caja.movimientos.filter((m: string & any) =>
      String(m.motivo).includes(`#${pedidoPracticaId}`),
    );
    expect(movimientosPractica).toHaveLength(0);
    // El efectivo de prácticas no suma al saldo teórico
    expect(caja.totales.saldoTeoricoCent).toBe(
      caja.saldoInicialCent + caja.totales.efectivoCobradoCent + caja.totales.entradasCent - caja.totales.salidasCent,
    );
  });

  it('el cobro de prácticas no mueve ni un céntimo en los informes', async () => {
    // Se comparan los mismos informes antes y después del cobro de prácticas:
    // si las prácticas contaran como venta, estas cifras habrían subido.
    const hoy = (await admin.get('/api/informes/hoy')).json();
    const productosAhoraCent = (await admin.get('/api/informes/productos'))
      .json()
      .productos.reduce((a: number, p: any) => a + p.importeCent, 0);

    expect(hoy.ventaCent).toBe(ventaAntesCent);
    expect(productosAhoraCent).toBe(productosAntesCent);

    // Y el informe de ventas cuadra con el del día
    const ventas = (await admin.get('/api/informes/ventas')).json();
    expect(hoy.ventaCent).toBe(ventas.totalCent);
  });

  it('la cadena de huellas sigue intacta después de practicar', async () => {
    const cadena = (await admin.get('/api/cobros/facturas-verificar')).json();
    expect(cadena.ok).toBe(true);
  });

  it('mientras tanto, una venta real sí factura con normalidad', async () => {
    const sala = (await admin.get('/api/sala')).json();
    const libre = sala.zonas.flatMap((z: any) => z.mesas).find((m: any) => m.estado === 'LIBRE');
    const pedido = (
      await admin.post('/api/pedidos', { tipo: 'MESA', mesaId: libre.id, comensales: 2 })
    ).json();

    const carta = (await admin.get('/api/carta')).json();
    const cana = carta.find((c: any) => c.nombre === 'Cervezas').productos[0];
    await admin.post(`/api/pedidos/${pedido.id}/lineas`, {
      lineas: [{ productoId: cana.id, cantidad: 2 }],
    });

    const cuenta = (await admin.get(`/api/cobros/pedido/${pedido.id}/cuenta`)).json();
    const cobro = await admin.post(`/api/cobros/pedido/${pedido.id}/cobrar`, {
      pagos: [{ metodo: 'TARJETA', importeCent: cuenta.pendienteCent }],
    });
    expect(cobro.statusCode).toBe(200);
    // Esta sí emite factura: es una venta de verdad
    expect(cobro.json().esPractica).toBe(false);
    expect(cobro.json().factura.codigo).toMatch(/^S-\d{4}-\d{6}$/);
    facturaRealCodigo = cobro.json().factura.codigo;
  });

  it('al terminar, borrar las prácticas deja la mesa libre', async () => {
    const antes = (await admin.get('/api/formacion/practicas')).json();
    expect(antes.total).toBeGreaterThan(0);

    const r = await admin.del('/api/formacion/practicas');
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    expect(r.json().borrados).toBeGreaterThan(0);

    const despues = (await admin.get('/api/formacion/practicas')).json();
    expect(despues.total).toBe(0);

    const mesa = (await admin.get(`/api/sala/mesas/${mesaId}`)).json();
    expect(mesa.estado).toBe('LIBRE');
    expect(mesa.pedido).toBeNull();

    // Y el pedido ya no existe
    const perdido = await admin.get(`/api/pedidos/${pedidoPracticaId}`);
    expect(perdido.statusCode).toBe(404);
  });

  it('borrar prácticas no toca las facturas reales', async () => {
    const facturas = (await admin.get('/api/cobros/facturas')).json();
    const sigueAhi = facturas.find((f: any) => f.codigo === facturaRealCodigo);
    expect(sigueAhi).toBeDefined();
    expect(sigueAhi.estado).toBe('EMITIDA');

    const cadena = (await admin.get('/api/cobros/facturas-verificar')).json();
    expect(cadena.ok).toBe(true);
    expect(cadena.total).toBeGreaterThan(0);
  });

  it('guarda el progreso de formación de cada empleado', async () => {
    const inicial = (await admin.get('/api/formacion')).json();
    expect(inicial.listo).toBe(false);

    for (const guia of inicial.pendientesEsenciales) {
      const r = await admin.post(`/api/formacion/${guia}/completada`);
      expect(r.statusCode).toBe(200);
    }

    const despues = (await admin.get('/api/formacion')).json();
    expect(despues.listo).toBe(true);

    // El progreso es de cada uno: otro empleado sigue sin formar
    const javi = api(app, await entrar(app, '3333'));
    expect((await javi.get('/api/formacion')).json().listo).toBe(false);
  });
});

/** Lee el siguiente número de la serie simplificada sin emitir nada. */
async function obtenerSiguienteNumeroSerie(app: FastifyInstance): Promise<number> {
  const { prisma } = await import('../src/lib/db.js');
  const serie = await prisma.serieFactura.findUnique({ where: { id: 'S' } });
  return serie!.siguienteNumero;
}
