import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { api, arrancarApp, entrar } from './ayudas.js';

/**
 * Recorre el servicio completo tal y como pasa en el local:
 * abrir caja -> sentar -> comandar -> cocina -> cobrar -> factura.
 */
describe('servicio completo de una mesa', () => {
  let app: FastifyInstance;
  let admin: ReturnType<typeof api>;
  let camarero: ReturnType<typeof api>;
  let cocina: ReturnType<typeof api>;
  let mesaId: string;
  let pedidoId: string;

  beforeAll(async () => {
    app = await arrancarApp();
    admin = api(app, await entrar(app, '1111'));
    camarero = api(app, await entrar(app, '3333'));
    cocina = api(app, await entrar(app, '4444'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('la carta cargada tiene la estructura del local', async () => {
    const r = await camarero.get('/api/carta');
    expect(r.statusCode).toBe(200);
    const categorias = r.json();
    const nombres = categorias.map((c: any) => c.nombre);
    expect(nombres).toContain('Hamburguesas');
    expect(nombres).toContain('Cover / Juegos');

    const burgers = categorias.find((c: any) => c.nombre === 'Hamburguesas');
    expect(burgers.destino).toBe('COCINA');
    const classic = burgers.productos.find((p: any) => p.nombre === "Columbia's Classic");
    expect(classic.precioCent).toBe(1250);
    expect(classic.alergenos.map((a: any) => a.id)).toContain('GLUTEN');
    expect(classic.gruposModificador.length).toBeGreaterThan(0);
  });

  it('abre la caja del día', async () => {
    const r = await admin.post('/api/caja/abrir', { saldoInicialCent: 15000 });
    expect(r.statusCode).toBe(200);
    expect(r.json().saldoInicialCent).toBe(15000);
  });

  it('las mesas salen en orden natural: M9 antes que M10', async () => {
    const sala = (await camarero.get('/api/sala')).json();
    const nombres = sala.zonas
      .find((z: any) => z.nombre === 'Sala')
      .mesas.map((m: any) => m.nombre);
    expect(nombres.slice(0, 10)).toEqual([
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10',
    ]);
  });

  it('abre un pedido en una mesa libre y la marca ocupada', async () => {
    const sala = (await camarero.get('/api/sala')).json();
    mesaId = sala.zonas[0].mesas[0].id;

    const r = await camarero.post('/api/pedidos', { tipo: 'MESA', mesaId, comensales: 4 });
    expect(r.statusCode).toBe(200);
    pedidoId = r.json().id;
    expect(r.json().estado).toBe('ABIERTO');

    const mesa = (await camarero.get(`/api/sala/mesas/${mesaId}`)).json();
    expect(mesa.estado).toBe('OCUPADA');
    expect(mesa.pedido.numero).toBeGreaterThan(0);
  });

  it('no deja abrir un segundo pedido en la misma mesa', async () => {
    const r = await camarero.post('/api/pedidos', { tipo: 'MESA', mesaId, comensales: 2 });
    expect(r.statusCode).toBe(409);
  });

  it('añade comida, bebida y el cover de la ludoteca', async () => {
    const carta = (await camarero.get('/api/carta')).json();
    const burger = carta
      .find((c: any) => c.nombre === 'Hamburguesas')
      .productos.find((p: any) => p.nombre === "Columbia's Classic");
    const cana = carta.find((c: any) => c.nombre === 'Cervezas').productos[0];

    const r = await camarero.post(`/api/pedidos/${pedidoId}/lineas`, {
      lineas: [
        {
          productoId: burger.id,
          cantidad: 2,
          modificadores: [{ nombre: 'Pan sin gluten', precioCent: 100 }],
          notas: 'Una sin cebolla',
        },
        { productoId: cana.id, cantidad: 4 },
      ],
    });
    expect(r.statusCode).toBe(200);

    const cover = await camarero.post(`/api/pedidos/${pedidoId}/cover`, {
      modalidad: 'CONSUMIENDO',
    });
    expect(cover.statusCode).toBe(200);

    const pedido = cover.json();
    // 2 burgers (12,50 + 1,00 pan) + 4 cañas (2,30) + 4 covers (4,00)
    expect(pedido.totales.brutoCent).toBe(2 * 1350 + 4 * 230 + 4 * 400);
    expect(pedido.lineas).toHaveLength(3);
  });

  it('envía la comanda y genera un ticket por destino', async () => {
    const r = await camarero.post(`/api/pedidos/${pedidoId}/enviar`);
    expect(r.statusCode).toBe(200);
    const { tickets, pedido } = r.json();
    expect(tickets.map((t: any) => t.destino).sort()).toEqual(['BARRA', 'COCINA']);

    // El cover no pasa por cocina: se da por servido directamente
    const lineaCover = pedido.lineas.find((l: any) => l.destino === 'NINGUNO');
    expect(lineaCover.estado).toBe('SERVIDO');
  });

  it('cocina ve solo lo suyo y lo marca listo', async () => {
    const r = await cocina.get('/api/cocina?destino=COCINA');
    expect(r.statusCode).toBe(200);
    const { tickets } = r.json();
    expect(tickets.length).toBeGreaterThan(0);

    const ticket = tickets.find((t: any) => t.pedido.id === pedidoId);
    expect(ticket.lineas.every((l: any) => l.nombre.includes('Classic'))).toBe(true);
    expect(ticket.lineas[0].modificadores[0].nombre).toBe('Pan sin gluten');

    const listo = await cocina.post(`/api/cocina/${ticket.id}/estado`, { estado: 'LISTO' });
    expect(listo.statusCode).toBe(200);
    expect(listo.json().estado).toBe('LISTO');

    const pedido = (await camarero.get(`/api/pedidos/${pedidoId}`)).json();
    const lineasBurger = pedido.lineas.filter((l: any) => l.destino === 'COCINA');
    expect(lineasBurger.every((l: any) => l.estado === 'LISTO')).toBe(true);
  });

  it('la barra no ve los tickets de cocina', async () => {
    const barra = api(app, await entrar(app, '5555'));
    const r = await barra.get('/api/cocina?destino=BARRA');
    const nombres = r.json().tickets.flatMap((t: any) => t.lineas.map((l: any) => l.nombre));
    expect(nombres).toContain('Caña');
    expect(nombres.some((n: string) => n.includes('Classic'))).toBe(false);
  });

  it('un camarero no puede tocar la carta', async () => {
    const r = await camarero.post('/api/carta/categorias', { nombre: 'Prohibida' });
    expect(r.statusCode).toBe(403);
    expect(r.json().codigo).toBe('PROHIBIDO');
  });

  it('un camarero no puede aplicar descuentos', async () => {
    const r = await camarero.post(`/api/pedidos/${pedidoId}/descuento`, {
      tipo: 'PORCENTAJE',
      valor: 50,
    });
    expect(r.statusCode).toBe(403);
  });

  it('el encargado sí puede aplicar un descuento y queda auditado', async () => {
    const encargado = api(app, await entrar(app, '2222'));
    const r = await encargado.post(`/api/pedidos/${pedidoId}/descuento`, {
      tipo: 'PORCENTAJE',
      valor: 10,
      motivo: 'Cliente habitual',
    });
    expect(r.statusCode).toBe(200);
    const pedido = r.json();
    expect(pedido.totales.descuentoPedidoCent).toBeGreaterThan(0);
    expect(pedido.totales.baseCent + pedido.totales.cuotaCent).toBe(pedido.totales.totalCent);

    const auditoria = (await admin.get('/api/usuarios/auditoria?limite=20')).json();
    expect(auditoria.some((a: any) => a.accion === 'PEDIDO_DESCUENTO')).toBe(true);
  });

  it('no deja cobrar de menos sin marcarlo como parcial', async () => {
    const cuenta = (await camarero.get(`/api/cobros/pedido/${pedidoId}/cuenta`)).json();
    const r = await camarero.post(`/api/cobros/pedido/${pedidoId}/cobrar`, {
      pagos: [{ metodo: 'TARJETA', importeCent: cuenta.pendienteCent - 100 }],
    });
    expect(r.statusCode).toBe(400);
  });

  it('cobra en mixto efectivo + tarjeta y emite factura simplificada', async () => {
    const cuenta = (await camarero.get(`/api/cobros/pedido/${pedidoId}/cuenta`)).json();
    const pendiente = cuenta.pendienteCent;

    const r = await camarero.post(`/api/cobros/pedido/${pedidoId}/cobrar`, {
      pagos: [
        { metodo: 'EFECTIVO', importeCent: 2000, entregadoCent: 2000 },
        {
          metodo: 'TARJETA',
          importeCent: pendiente - 2000,
          propinaCent: 200,
          refAutorizacion: '004521',
          ultimos4: '4242',
        },
      ],
    });
    expect(r.statusCode).toBe(200);
    const res = r.json();
    expect(res.cerrado).toBe(true);
    expect(res.pedido.estado).toBe('COBRADO');
    expect(res.factura.codigo).toMatch(/^S-\d{4}-\d{6}$/);
    expect(res.factura.totalCent).toBe(pendiente);

    const mesa = (await camarero.get(`/api/sala/mesas/${mesaId}`)).json();
    expect(mesa.estado).toBe('LIMPIEZA');
  });

  it('el recibo se guarda y se puede recuperar para reimprimir', async () => {
    const facturas = (await admin.get('/api/cobros/facturas')).json();
    expect(facturas.length).toBeGreaterThan(0);

    const recibo = await admin.get(`/api/cobros/facturas/${facturas[0].id}/recibo`);
    expect(recibo.statusCode).toBe(200);
    expect(recibo.headers['content-type']).toContain('text/html');
    // El generador escapa el HTML: el apostrofo sale como entidad
    expect(recibo.body).toContain('Columbia&#39;s');
    expect(recibo.body).toContain('Desglose de IVA');
    expect(recibo.body).toContain('****4242');
  });

  it('la cadena de huellas de las facturas está intacta', async () => {
    const r = await admin.get('/api/cobros/facturas-verificar');
    expect(r.json().ok).toBe(true);
    expect(r.json().total).toBeGreaterThan(0);
  });

  it('un pedido cobrado no se puede volver a cobrar', async () => {
    const r = await camarero.post(`/api/cobros/pedido/${pedidoId}/cobrar`, {
      pagos: [{ metodo: 'EFECTIVO', importeCent: 100 }],
    });
    expect(r.statusCode).toBe(409);
  });

  it('emite factura completa con NIF sobre el pedido ya cobrado', async () => {
    const r = await admin.post('/api/cobros/facturas/completa', {
      pedidoId,
      cliente: {
        nombre: 'Empresa de Pruebas S.L.',
        nif: 'B12345678',
        direccion: 'Calle Falsa 123',
        cp: '28002',
        ciudad: 'Madrid',
      },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().codigo).toMatch(/^F-\d{4}-\d{6}$/);
  });

  it('la rectificativa anula la original con importes en negativo', async () => {
    const facturas = (await admin.get('/api/cobros/facturas?tipo=COMPLETA')).json();
    const completa = facturas[0];

    const r = await admin.post(`/api/cobros/facturas/${completa.id}/rectificar`, {
      motivo: 'Error en los datos del cliente',
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().totalCent).toBe(-completa.totalCent);

    const despues = (await admin.get(`/api/cobros/facturas/${completa.id}`)).json();
    expect(despues.estado).toBe('ANULADA');

    const cadena = (await admin.get('/api/cobros/facturas-verificar')).json();
    expect(cadena.ok).toBe(true);
  });

  it('el cierre de caja cuadra el efectivo cobrado', async () => {
    const caja = (await admin.get('/api/caja/actual')).json();
    // Fondo 150 € + 20 € cobrados en efectivo
    expect(caja.totales.efectivoCobradoCent).toBe(2000);
    expect(caja.totales.saldoTeoricoCent).toBe(15000 + 2000);

    const r = await admin.post('/api/caja/cerrar', {
      arqueo: { '5000': 3, '1000': 1, '500': 1, '200': 1, '100': 1 },
    });
    expect(r.statusCode).toBe(200);
    // 150 + 10 + 5 + 2 + 1 = 168 € contados frente a 170 € teóricos
    expect(r.json().saldoFinalContadoCent).toBe(16800);
    expect(r.json().descuadreCent).toBe(-200);
  });

  it('el informe del día recoge la venta', async () => {
    const r = await admin.get('/api/informes/hoy');
    expect(r.json().pedidosCobrados).toBeGreaterThan(0);
    expect(r.json().ventaCent).toBeGreaterThan(0);
  });
});
