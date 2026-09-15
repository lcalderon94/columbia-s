# Formación de empleados

Guías que se ejecutan **encima del programa real**, señalando cada botón. Un
empleado nuevo las hace en unos veinte minutos y puede empezar el turno.

Están en **Formación**, en el menú. Quien entra por primera vez recibe además un
aviso ofreciéndoselas.

## Las guías

Cuatro están marcadas como **imprescindibles**: son las que tocan dinero.

| Guía | Minutos | |
|---|---|---|
| Primeros pasos | 2 | Qué es cada pantalla |
| La sala y las mesas | 2 | Leer el plano, abrir una mesa |
| **Tomar una comanda** | 4 | **Imprescindible** |
| Cocina y barra | 2 | Cómo se lee la pantalla de producción |
| **Cobrar una cuenta** | 6 | **Imprescindible** |
| **Abrir la caja** | 2 | **Imprescindible** |
| **Cerrar la caja (arqueo)** | 5 | **Imprescindible** |
| Juegos y cover | 2 | Ludoteca y cover fee |
| Reservas | 2 | Apuntar y sentar |

El progreso se guarda **por empleado en el servidor**, así que le sigue aunque
cambie de puesto o de tablet. Cada uno ve el suyo.

Se sale de una guía con `Esc` en cualquier momento. Solo cuenta como completada
si se llega al último paso y se pulsa **Terminar**.

## Modo prácticas

Las guías de comanda y de cobro no explican en seco: abren **un pedido de
prácticas de verdad** y el empleado lo trabaja en las pantallas reales.

Mientras está activo se ve una **franja violeta** permanente, y el pedido lleva
su distintivo. Es a propósito: lo peor que podría pasar es que alguien creyera
estar cobrando de verdad.

### Qué hace distinto a un pedido de prácticas

Se comporta igual en sala y en cocina —ocupa mesa, genera tickets, se cobra—
pero:

- **No emite ninguna factura.**
- **No toca la caja**: ni el efectivo ni los movimientos.
- **No cuenta como venta** en ningún informe.
- El recibo sale marcado **PRÁCTICAS · SIN VALIDEZ** y sin huella.

### Por qué está aislado así, y no solo "se borra luego"

Porque un número de factura **no se puede devolver**.

Si las prácticas emitieran facturas de verdad, borrarlas después dejaría un
hueco en la numeración y rompería la cadena de huellas que hace inalterable el
registro (ver [facturacion.md](facturacion.md)). No habría forma de arreglarlo.

Por eso el aislamiento está en el momento del cobro, no en la limpieza
posterior: un pedido de prácticas nunca llega a pedir número de serie.

Hay cuatro pruebas automáticas que lo vigilan: que cobrar en prácticas no emite
factura, que el contador de la serie no se mueve, que los informes no cambian ni
un céntimo, y que una factura real emitida en medio sigue intacta después de
borrar las prácticas.

### Borrar los datos de prácticas

Al terminar, en **Formación → Borrar datos de prácticas**, o desde el botón de
la franja violeta. Se borran los pedidos de formación y se liberan sus mesas.

Es seguro por construcción: como nunca hubo factura ni entrada en caja, no hay
nada contable que pueda quedar descuadrado. Aun así, si por lo que fuera
apareciera una factura ligada a un pedido de prácticas, **no se borra nada** y
se avisa, en vez de dejar una factura huérfana.

## Simulador de arqueo

En Formación hay un **cajón de mentira** para practicar el cierre: se escribe lo
que debería haber, se cuenta por billetes y monedas, y sale el descuadre
explicado —si falta, si sobra y qué suele significar cada caso—. No toca la caja
real ni guarda nada.

Es la parte que más cuesta al principio y la que más dinero hace perder si se
hace mal.

## Para el encargado

- **Antes del primer turno**, que cada uno haga las cuatro imprescindibles.
  En su pantalla de Formación se ve si le falta alguna.
- La formación se puede repetir cuantas veces haga falta: las guías completadas
  quedan con **Repetir**.
- **Empezar la formación de cero** reinicia el progreso de quien lo pulsa.
- Las prácticas son mejor **fuera del servicio**: aunque no cuentan como venta,
  ocupan mesa de verdad y sus comandas salen en la pantalla de cocina.
