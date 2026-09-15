# Roles y permisos

Hay cinco roles. La matriz completa vive en un solo sitio,
`server/src/types/dominio.ts`, para que «quién puede hacer qué» se pueda leer de
un vistazo y no quede repartido por el código.

| | Administrador | Encargado | Camarero | Cocina | Barra |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver sala | ✅ | ✅ | ✅ | — | ✅ |
| Editar el plano de sala | ✅ | ✅ | — | — | — |
| Gestionar reservas | ✅ | ✅ | ✅ | — | — |
| Tomar comandas | ✅ | ✅ | ✅ | — | — |
| Anular línea ya enviada | ✅ | ✅ | — | — | — |
| Aplicar descuentos | ✅ | ✅ | — | — | — |
| Invitar productos | ✅ | ✅ | — | — | — |
| Dividir y mover cuentas | ✅ | ✅ | ✅ | — | — |
| Pantalla de cocina/barra | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cobrar | ✅ | ✅ | ✅ | — | — |
| Anular un cobro | ✅ | ✅ | — | — | — |
| Emitir factura | ✅ | ✅ | ✅ | — | — |
| Rectificar factura | ✅ | ✅ | — | — | — |
| Abrir y cerrar caja | ✅ | ✅ | — | — | — |
| Movimientos de caja | ✅ | ✅ | — | — | — |
| Gestionar la ludoteca | ✅ | ✅ | ✅ | — | — |
| Editar la carta | ✅ | ✅ | — | — | — |
| Informes | ✅ | ✅ | — | — | — |
| Gestionar usuarios | ✅ | — | — | — | — |
| Datos fiscales del local | ✅ | — | — | — | — |

## Cómo se aplica

Cada endpoint declara el permiso que exige:

```ts
app.post('/:id/descuento', { preHandler: requierePermiso('pedidos.descuento') }, ...)
```

El cliente usa la misma lista para esconder botones, pero **la comprobación real
está siempre en el servidor**: ocultar un botón no es seguridad. Hay una prueba
que verifica que un camarero recibe `403` al intentar aplicar un descuento o
tocar la carta.

## Entrada al sistema

- **Por PIN**: el flujo normal en barra. Cuatro dígitos y dentro. Cada PIN debe
  ser único; el sistema lo comprueba al crear o editar un usuario.
- **Por email y contraseña**: para administración desde el despacho. Solo lo
  tienen los usuarios a los que se les configura email.

Los PIN y las contraseñas se guardan con bcrypt, nunca en claro.

## Auditoría

Todo lo sensible deja rastro con quién, cuándo y con qué detalle: anulaciones de
línea y de pedido, descuentos, invitaciones, cambios de precio, aperturas y
cierres de caja, cobros, y facturas rectificadas. Se consulta en
**Ajustes → Auditoría**.

## Bajas

Un usuario nunca se borra, se da de baja. Su histórico de pedidos y cobros tiene
que seguir apuntando a él. Además, el sistema impide dejar el local sin ningún
administrador activo.
