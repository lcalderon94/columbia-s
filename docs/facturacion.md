# Facturación e IVA

## Todo el dinero en céntimos

No hay un solo `float` en el sistema. Los importes se guardan y se operan como
enteros de céntimos (`precioCent`, `totalCent`, `baseCent`). El redondeo ocurre
en un único sitio, `server/src/lib/dinero.ts`, y está cubierto por pruebas que
comprueban que `base + cuota == total` para todos los importes de 0,01 € a 30 €
en los tipos 4 %, 10 % y 21 %.

## Los precios de carta llevan el IVA dentro

En hostelería el precio que ve el cliente es el precio final. Por eso el sistema
**desglosa hacia atrás**:

```
base  = redondear(total × 100 / (100 + tipo))
cuota = total − base
```

Calcular la cuota así, y no multiplicando la base, garantiza que la suma cuadre
al céntimo aunque el redondeo caiga justo en el medio.

## Tipo de IVA

Cada producto lleva su propio `ivaTipo`. La carta se carga al **10 %**, que es
el tipo de los servicios de hostelería: comida y bebida servida para consumir en
el local. Se puede poner 21 % producto a producto desde **Ajustes → Carta**, por
ejemplo si algún día se vende producto envasado para llevar.

> Esto no es asesoramiento fiscal. El tipo aplicable a cada producto conviene
> confirmarlo con la gestoría del local; el sistema permite configurarlo.

## Descuentos

Un descuento de pedido se reparte entre las líneas **en proporción a su importe**
antes de desglosar el IVA. Si no se hiciera así, un pedido con productos a tipos
distintos daría un desglose que no cuadra con el total. El céntimo que sobra del
reparto se asigna a la última línea con importe, de modo que la suma de las
líneas es exactamente el total cobrado.

## Series de facturación

| Serie | Para qué |
|---|---|
| `S` | Factura simplificada (el ticket normal) |
| `F` | Factura completa, con NIF del cliente |
| `R` | Factura rectificativa |

El número se reserva dentro de la misma transacción que crea la factura, así que
dos cobros simultáneos no pueden obtener el mismo número. El código queda como
`S-2026-000001`.

## Nada se borra

Una factura emitida no se modifica ni se elimina nunca. Para anularla se emite
una **rectificativa** con los importes en negativo que la referencia, y la
original pasa a estado `ANULADA`. Ambas quedan en el registro.

Lo mismo con las líneas de pedido: una línea que ya ha salido a cocina no se
borra, se marca como anulada con un motivo y queda en la auditoría.

## Encadenado de huellas

Cada factura guarda un `hash` SHA-256 que incluye el hash de la factura
inmediatamente anterior:

```
hash = SHA256(código | NIF emisor | NIF cliente | fecha | total | cuota | hash anterior)
```

Si alguien modificase una factura pasada directamente en la base de datos, su
huella dejaría de cuadrar y todas las posteriores quedarían descolgadas. La
pantalla de **Facturas** verifica la cadena entera y avisa del primer eslabón
roto.

El NIF del emisor se **congela en la factura** al emitirla. Así, cambiar los
datos fiscales del local en Ajustes no invalida la verificación de lo ya emitido.

### Sobre Veri*Factu

Esto construye la parte de *registro de facturación inalterable y encadenado*:
numeración correlativa, huella encadenada, imposibilidad de borrado y
rectificación mediante factura rectificativa.

**Lo que no incluye** es el envío de los registros a la AEAT ni el código QR con
la URL de cotejo, que es la otra mitad del reglamento. Antes de operar hay que
confirmar con la gestoría qué obligaciones aplican al local y en qué fecha, y
completar esa parte. La estructura de datos ya está preparada para ello.

## Recibos guardados

Al emitir cada factura se genera su recibo en HTML de 80 mm y se escribe en
disco, en `server/datos/recibos/<año>/<código>.html`. Es el documento tal y como
se imprimió, y se puede reimprimir en cualquier momento desde **Facturas →
Recibo**.

La ruta se configura con `DIR_RECIBOS` en `server/.env`. **Esa carpeta y el
fichero `server/prisma/columbias.db` son lo que hay que incluir en la copia de
seguridad diaria.**

## Libro de IVA

En **Facturas** hay un resumen del IVA repercutido del periodo, con base y cuota
por tipo, listo para pasárselo a la gestoría.
