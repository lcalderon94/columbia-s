# Manual de uso

## Antes de abrir el local

1. **Ajustes → Datos del local**: pon el nombre, la razón social, el NIF y la
   dirección reales. Es lo que sale impreso en cada recibo.
2. **Ajustes → Usuarios**: cambia los PIN de ejemplo y da de alta al equipo.
3. **Ajustes → Carta**: revisa precios y alérgenos.
4. **Ludoteca**: da de alta los juegos con su estante, para encontrarlos rápido.

## Cada día

### Abrir caja

**Caja → Abrir caja** e indica el fondo que dejas para cambios. Sin caja abierta
el sistema no deja cobrar en efectivo, a propósito: así no se pierde el rastro
del dinero.

### Sentar a la gente

- **Sin reserva**: en **Sala**, toca una mesa libre, indica cuántos son y se abre
  el pedido.
- **Con reserva**: en **Reservas**, botón **Sentar**. Marca las mesas como
  ocupadas y abre el pedido con el número de personas de la reserva.

### Tomar la comanda

En el TPV, toca los productos. Si el producto tiene opciones (punto de la carne,
pan sin gluten, quitar ingredientes, extras) se abre el selector.

- **🎲 Cover**: carga el acceso a la ludoteca por persona. 4 € si consumen, 7 € si
  solo vienen a jugar.
- **Prestar juego**: asocia el juego a la mesa. Al cobrar se devuelve solo al
  catálogo.
- **Línea libre**: para cobrar algo que no está en carta.
- Nota para cocina: botón **⋯** en la línea. Va impresa en el ticket, en amarillo.

Cuando esté lista, **Enviar**. Lo de cocina va a la pantalla de cocina y lo de
barra a la de barra, cada uno con su ticket.

Puedes seguir añadiendo y enviar otra ronda: se numera sola.

### Cocina y barra

Tres columnas: **Nuevas**, **En marcha**, **Listas para servir**. El borde de
cada tarjeta se pone ámbar a los 12 minutos y rojo a los 20, para ver de un
vistazo qué se está retrasando.

Un toque en **Empezar** → **Marcar lista** → **Entregada**. El camarero ve el
mismo estado desde el TPV.

### Cobrar

Botón **Cobrar** en el pedido.

- **Efectivo**: escribe lo entregado y el sistema calcula el cambio. Hay botones
  rápidos de 5, 10, 20 y 50 €.
- **Tarjeta**: pasa la tarjeta por el datáfono y anota el número de autorización
  y los cuatro últimos dígitos. Queda en el recibo y sirve para cuadrar.
- **Pago mixto**: añade un cobro parcial con un método, luego el resto con otro.
- **Dividir a partes iguales**: reparte lo pendiente sin perder céntimos.
- **Cuentas separadas**: en el pedido, **Dividir**, marca las líneas que van
  aparte y se crea otro pedido con ellas.

Marca si quieres **ticket** (factura simplificada) o **factura con NIF**. En
ambos casos se guarda el recibo y se puede reimprimir siempre desde **Facturas**.

Si el cliente pide factura después de haber pagado: **Facturas** o el propio
pedido → emitir factura completa con sus datos.

### Cerrar caja

**Caja → Cerrar caja (Z)**. Cuenta el cajón e introduce cuántos billetes y
monedas hay de cada valor. El sistema compara con lo que debería haber y registra
el descuadre.

No deja cerrar si quedan pedidos sin cobrar: primero se cobran o se anulan.

## Cosas que conviene saber

- **Un descuento siempre pide motivo** y queda registrado con quién lo hizo.
- **Una línea ya enviada a cocina no se borra**: se anula con motivo, y cocina ve
  que se ha caído.
- **Una factura emitida no se toca**: si hay que anularla se emite una
  rectificativa. Las dos quedan.
- **Cambiar un precio en la carta** no afecta a los pedidos ya abiertos.
- **Mesas unidas**: en Sala puedes unir varias mesas para un grupo grande y
  separarlas después.

## Si algo va mal

| Qué pasa | Qué hacer |
|---|---|
| «No hay ninguna caja abierta» al cobrar en efectivo | Ve a **Caja** y ábrela. |
| «Esa mesa ya tiene un pedido abierto» | Toca la mesa: te lleva al pedido que ya existe. |
| «Esas mesas ya están reservadas a esa hora» | El sistema evita solapamientos. Cambia la hora o elige otra mesa. |
| Se cobró de menos o de más | Si no hay factura emitida, anula el cobro desde el pedido. Si ya la hay, emite una rectificativa. |
| La pantalla no se actualiza | Refresca (F5). Las pantallas se recargan solas cada pocos segundos de todos modos. |
| Aviso de cadena de huellas rota en Facturas | Alguien ha modificado la base de datos por fuera. Avisa a la gestoría y restaura la copia de seguridad. |

## Copias de seguridad

Copia cada día estos dos elementos:

- `server/prisma/columbias.db`
- la carpeta `server/datos/recibos/`

Con eso se reconstruye el local entero.
