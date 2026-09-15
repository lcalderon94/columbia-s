# Arquitectura y decisiones

## Forma general

```
columbia-s/
├── server/          API + base de datos
│   ├── prisma/      esquema y carga inicial (la carta)
│   └── src/
│       ├── lib/     utilidades transversales (dinero, auth, auditoría…)
│       ├── modules/ un módulo por área del negocio
│       └── types/   dominio compartido: roles, permisos, estados
└── client/          aplicación de pantalla
    └── src/
        ├── lib/     API, sesión, socket, formato
        ├── pages/   una pantalla por área
        └── components/
```

Cada módulo del servidor (`auth`, `carta`, `sala`, `reservas`, `pedidos`,
`cocina`, `cobros`, `caja`, `juegos`, `usuarios`, `informes`) es un plugin de
Fastify que registra sus rutas bajo `/api/<módulo>`.

## Por qué SQLite

El local tiene un puesto de cobro. Un servidor de base de datos aparte sería una
pieza más que administrar, actualizar y que puede caerse en plena cena. Con
SQLite la base es un fichero: la copia de seguridad es copiarlo, y no hay
proceso extra que vigilar.

Todo el acceso pasa por Prisma, así que el día que haya un segundo local y haga
falta PostgreSQL, el cambio es el conector del `schema.prisma` y una migración,
no reescribir consultas.

## Dinero en céntimos enteros

Ver [facturacion.md](facturacion.md). Ningún importe es decimal en ningún punto
del sistema.

## Snapshot de precios en las líneas

Cuando se añade un producto a un pedido, la línea **copia** el nombre, el precio,
el tipo de IVA y los modificadores. No guarda solo una referencia al producto.

Así, subir el precio de una hamburguesa a mediodía no cambia el importe de las
mesas que la pidieron por la mañana, y una factura de hace seis meses sigue
mostrando lo que realmente se cobró.

## Estados como texto validado

SQLite no admite enums en Prisma, así que los estados viajan como `String` y se
validan con Zod en el borde de la API, desde las listas de
`src/types/dominio.ts`. Es el mismo sitio del que salen los tipos de TypeScript,
de modo que añadir un estado nuevo obliga a tratarlo en todos los puntos.

## Tiempo real por canales

Socket.IO con salas por canal: `sala`, `cocina`, `barra`, `caja`, `reservas`,
`juegos`. Cada pantalla se suscribe solo a lo suyo, así que la pantalla de cocina
no recibe el ruido de los cobros.

Los eventos son señales, no datos: dicen «algo cambió» y la pantalla recarga con
TanStack Query. Es más simple de razonar que sincronizar estado por el socket, y
evita que dos puestos acaben viendo cosas distintas. Como red de seguridad, cada
pantalla refresca también por intervalo, para que los minutos de espera de cocina
suban solos aunque se pierda un evento.

## Un ticket por destino y ronda

Al enviar la comanda se crea un ticket para cocina y otro para barra, con el
número de ronda. Cada producto sabe a dónde va por su categoría (que se puede
sobreescribir producto a producto). Lo que no pasa por producción, como el cover
de la ludoteca, se marca como servido directamente y no ensucia ninguna pantalla.

## Numeración con contador atómico

Los números de pedido, reserva y caja salen de una tabla `Contador`, leída e
incrementada dentro de la transacción de la operación. SQLite solo permite
`autoincrement()` en la clave primaria, y además así el número solo se consume
si la operación cuaja.

## Transacciones en el cobro

El cobro completo (registrar pagos, crear movimientos de caja, cerrar el pedido,
emitir la factura, liberar la mesa y devolver los juegos) ocurre dentro de una
sola transacción. No puede quedar un cobro registrado sin su factura, ni una
factura sin su cobro.

## El datáfono es externo

El TPV físico no está integrado: se pasa la tarjeta en el datáfono y en la
aplicación se anota el importe, el número de autorización y los cuatro últimos
dígitos, que es lo que hace falta para cuadrar la caja y localizar una operación.

Si algún día se integra un terminal (Redsys, Stripe Terminal), el sitio por donde
entra es el registro de `Pago`: ya tiene los campos `refTerminal`,
`refAutorizacion` y `ultimos4`, y el cobro se puede pasar a confirmarse contra el
terminal sin tocar el resto.

## Qué hay que respaldar

- `server/prisma/columbias.db` — toda la base de datos
- `server/datos/recibos/` — los recibos emitidos

Con esos dos el local se reconstruye entero.

## Pruebas

40 pruebas con Vitest sobre una base SQLite limpia que se crea y se carga con la
carta real antes de cada ejecución:

- **`dinero.test.ts`** — el desglose de IVA no pierde céntimos en ningún importe.
- **`totales.test.ts`** — descuentos de línea y de pedido, invitaciones, anuladas,
  y que el desglose siempre cuadre con el total.
- **`flujo.test.ts`** — el servicio completo: abrir caja, sentar, comandar, ver
  cómo cocina y barra reciben solo lo suyo, comprobar que un camarero no puede
  descontar, cobrar en mixto, emitir factura, rectificarla, verificar la cadena
  de huellas y cerrar caja con descuadre.
