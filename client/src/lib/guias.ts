import type { DriveStep } from 'driver.js';

export interface Guia {
  id: string;
  titulo: string;
  descripcion: string;
  minutos: number;
  esencial: boolean;
  /** Dónde tiene que estar el empleado para que la guía tenga sentido. */
  ruta: string;
  /** Si la guía necesita un pedido de prácticas abierto para poder enseñarse. */
  necesitaPedido?: boolean;
  pasos: (contexto: { pedidoId?: string }) => DriveStep[];
}

const paso = (
  elemento: string | undefined,
  titulo: string,
  texto: string,
  lado: 'top' | 'bottom' | 'left' | 'right' = 'bottom',
): DriveStep => ({
  element: elemento,
  popover: {
    title: titulo,
    description: texto,
    side: lado,
    align: 'start',
  },
});

/** Tarjeta centrada, sin señalar nada: para introducir o cerrar una guía. */
const tarjeta = (titulo: string, texto: string): DriveStep => ({
  popover: { title: titulo, description: texto },
});

export const GUIAS: Guia[] = [
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    descripcion: 'Qué es cada pantalla y cómo moverte por el programa.',
    minutos: 2,
    esencial: false,
    ruta: '/sala',
    pasos: () => [
      tarjeta(
        'Bienvenido a Columbia\'s',
        'En cinco minutos vas a saber tomar una comanda y cobrarla. Puedes salir de la guía cuando quieras con Esc y retomarla luego.',
      ),
      paso(
        '[data-guia="menu"]',
        'El menú',
        'Todo está aquí. Solo ves lo que tu puesto necesita: si eres camarero no te aparecerán los informes ni los ajustes.',
        'right',
      ),
      paso(
        '[data-guia="menu-sala"]',
        'Sala',
        'El plano del local. Es donde empieza todo: se toca una mesa y se abre su pedido.',
        'right',
      ),
      paso(
        '[data-guia="menu-caja"]',
        'Caja',
        'Abrir la caja al empezar el turno y cerrarla al acabar. Sin caja abierta no se puede cobrar en efectivo.',
        'right',
      ),
      paso(
        '[data-guia="cabecera"]',
        'Cómo va el día',
        'De un vistazo: cuánto se lleva vendido, cuántas mesas hay ocupadas y cuántas comandas esperan en cocina.',
        'bottom',
      ),
      paso(
        '[data-guia="usuario"]',
        'Tu sesión',
        'Aquí ves con quién estás dentro. Todo lo que hagas queda a tu nombre, así que sal siempre al acabar tu turno.',
        'left',
      ),
      tarjeta(
        'Ya está',
        'Sigue con <strong>La sala y las mesas</strong>, o salta directo a <strong>Cobrar una cuenta</strong> si es lo que necesitas hoy.',
      ),
    ],
  },

  {
    id: 'sala',
    titulo: 'La sala y las mesas',
    descripcion: 'Leer el plano, abrir una mesa y saber qué significa cada color.',
    minutos: 2,
    esencial: false,
    ruta: '/sala',
    pasos: () => [
      tarjeta(
        'El plano de la sala',
        'Cada tarjeta es una mesa. El color te dice su estado sin tener que leer nada.',
      ),
      paso('[data-guia="zonas"]', 'Las zonas', 'Sala, Zona de juego, Terraza y Barra. El número pequeño es cuántas mesas están ocupadas.', 'bottom'),
      paso('[data-guia="mesa"]', 'Una mesa', 'Blanca está libre. Al tocarla eliges cuántos son y se abre el pedido.', 'right'),
      paso('[data-guia="leyenda"]', 'Los colores', 'Ámbar = ocupada, con su importe a la vista. Azul = reservada. Violeta = por limpiar.', 'bottom'),
      tarjeta(
        'Una mesa ocupada',
        'Si tocas una mesa que ya tiene pedido, entras directo a su comanda. Nunca se abren dos cuentas en la misma mesa por error.',
      ),
    ],
  },

  {
    id: 'comanda',
    titulo: 'Tomar una comanda',
    descripcion: 'Añadir bebida y comida, poner notas para cocina y enviarla.',
    minutos: 4,
    esencial: true,
    ruta: '/pedido',
    necesitaPedido: true,
    pasos: () => [
      tarjeta(
        'Vamos a comandar',
        'Estás en un pedido de <strong>prácticas</strong>: se comporta igual que uno real, pero no cuenta como venta y se borra al terminar.',
      ),
      paso('[data-guia="categorias"]', 'Las categorías', 'La carta entera. Arriba la comida, abajo las bebidas: Refrescos, Cafés, Cervezas, Vinos, Combinados.', 'bottom'),
      paso('[data-guia="buscador"]', 'El buscador', 'Más rápido que buscar la pestaña. Escribe "caña" y te sale directamente.', 'bottom'),
      paso('[data-guia="productos"]', 'Añadir', 'Un toque en el producto y entra en la comanda. Las bebidas entran directas; la comida te pregunta el punto, el pan y los extras.', 'right'),
      paso('[data-guia="comanda"]', 'La comanda', 'Lo que lleva la mesa. Con − y + cambias cantidades, y con ⋯ pones una nota para cocina: "sin cebolla", "alergia al huevo".', 'left'),
      paso('[data-guia="cover"]', 'El cover', 'El acceso a la ludoteca: 4 € por persona si consumen, 7 € si solo vienen a jugar. Se carga por personas.', 'bottom'),
      paso('[data-guia="juego"]', 'Prestar un juego', 'Deja el juego apuntado a esta mesa. Al cobrar vuelve solo al catálogo, así no se pierde ninguno.', 'bottom'),
      paso('[data-guia="enviar"]', 'Enviar a cocina', 'Este es el botón importante. Hasta que no lo pulsas, cocina no ve nada.', 'top'),
      tarjeta(
        'Qué pasa al enviar',
        'La comida va a la pantalla de <strong>cocina</strong> y la bebida a la de <strong>barra</strong>, cada una con su ticket. No tienes que repartir nada.<br><br>Puedes seguir añadiendo y enviar otra ronda: se numeran solas.',
      ),
    ],
  },

  {
    id: 'cocina',
    titulo: 'Cocina y barra',
    descripcion: 'Cómo se lee la pantalla de producción y cómo se marca lo que sale.',
    minutos: 2,
    esencial: false,
    ruta: '/cocina',
    pasos: () => [
      tarjeta('La pantalla de cocina', 'Tres columnas y nada más. Se lee de izquierda a derecha.'),
      paso('[data-guia="kds-columnas"]', 'Las tres columnas', 'Nuevas → En marcha → Listas para servir. Cada comanda avanza con un toque.', 'bottom'),
      paso('[data-guia="kds-resumen"]', 'El resumen', 'Cuántas hay en cada estado y cuánto lleva esperando la más antigua.', 'bottom'),
      tarjeta(
        'Los colores del tiempo',
        'El borde de cada comanda avisa solo:<br><br>• <strong>Gris</strong>: menos de 12 minutos<br>• <strong>Ámbar</strong>: 12 minutos o más<br>• <strong>Rojo</strong>: 20 minutos o más<br><br>Las notas del camarero salen en amarillo: son alergias o cambios, léelas siempre.',
      ),
      paso('[data-guia="kds-pantalla"]', 'Pantalla completa', 'Para dejar la tablet fija en esta vista, colgada en la pared.', 'left'),
    ],
  },

  {
    id: 'cobro',
    titulo: 'Cobrar una cuenta',
    descripcion: 'Efectivo, tarjeta, pago mixto, dividir la cuenta y cuándo hace falta factura.',
    minutos: 6,
    esencial: true,
    ruta: '/cobro',
    necesitaPedido: true,
    pasos: () => [
      tarjeta(
        'Cobrar',
        'Lo más importante que vas a hacer. Sigues en <strong>prácticas</strong>: aquí no se cobra dinero de verdad ni se emite ninguna factura.',
      ),
      paso('[data-guia="cobro-cuenta"]', 'La cuenta', 'Lo que ha consumido la mesa. Repásala con el cliente antes de cobrar.', 'right'),
      paso('[data-guia="cobro-total"]', 'El total', 'El precio ya lleva el IVA dentro. Debajo ves la base y la cuota: eso es para la gestoría, no para el cliente.', 'right'),
      paso('[data-guia="cobro-metodos"]', 'Forma de pago', 'Lo primero: cómo va a pagar.', 'bottom'),
      tarjeta(
        'Si paga en efectivo',
        'Escribe en <strong>Entregado</strong> lo que te da (hay botones de 5, 10, 20 y 50 €) y el programa te dice <strong>el cambio exacto</strong> en verde. No eches cuentas de cabeza.<br><br>Ojo: el efectivo necesita la caja abierta.',
      ),
      tarjeta(
        'Si paga con tarjeta',
        'La tarjeta se pasa por el <strong>datáfono</strong>, que va aparte. Cuando salga el recibo, copia aquí el <strong>número de autorización</strong> y los <strong>cuatro últimos dígitos</strong>.<br><br>Parece una tontería, pero es lo que te salva si al día siguiente hay que buscar un cobro o un cliente reclama.',
      ),
      paso('[data-guia="cobro-importe"]', 'El importe', 'Si lo dejas vacío, cobra todo lo que queda pendiente. Que es lo normal.', 'bottom'),
      paso('[data-guia="cobro-parcial"]', 'Pagan a medias', 'Pon el importe del primero, pulsa <strong>Añadir cobro parcial</strong>, y luego el del segundo con su forma de pago. Uno en efectivo y otro con tarjeta: sin problema.', 'top'),
      paso('[data-guia="cobro-dividir"]', 'A partes iguales', 'Para repartir entre 3, 4 o los que sean. Reparte sin perder ni un céntimo.', 'top'),
      paso('[data-guia="cobro-factura"]', 'Ticket o factura', 'Por defecto sale el <strong>ticket</strong>, que vale para casi todo el mundo.<br><br>Si el cliente pide <strong>factura</strong> a nombre de una empresa, cambia aquí y pide su NIF: sin NIF no se puede emitir.', 'top'),
      paso('[data-guia="cobro-boton"]', 'Y a cobrar', 'Cuando todo cuadre. Se cierra la cuenta, se emite el recibo y la mesa queda por limpiar.', 'top'),
      tarjeta(
        'Si te equivocas',
        'Mientras no se haya emitido la factura, un cobro mal metido se puede anular desde el pedido.<br><br>Si ya hay factura, <strong>no se borra nunca</strong>: se emite una rectificativa. Eso lo hace un encargado. Avisa y no lo intentes arreglar por tu cuenta.',
      ),
    ],
  },

  {
    id: 'caja-abrir',
    titulo: 'Abrir la caja',
    descripcion: 'Lo primero del turno. Sin esto no se puede cobrar en efectivo.',
    minutos: 2,
    esencial: true,
    ruta: '/caja',
    pasos: () => [
      tarjeta(
        'Abrir caja',
        'Es lo primero que se hace al llegar, antes de que entre nadie. Si no, el primer cliente que pague en efectivo te va a dar un aviso.',
      ),
      paso('[data-guia="caja-abrir"]', 'Abrir caja', 'Aquí. Solo se puede tener una caja abierta a la vez.', 'bottom'),
      tarjeta(
        'El fondo de caja',
        'El dinero que dejas en el cajón <strong>para dar cambios</strong>, normalmente 150 €. No es una venta: es lo que ya había ahí.<br><br>Cuéntalo antes de escribirlo. Si pones un número que no es, al cerrar te va a salir un descuadre que no existe.',
      ),
      tarjeta(
        'Ya está abierta',
        'A partir de ahora, cada cobro en efectivo se anota solo en la caja. Tú no tienes que apuntar nada.',
      ),
    ],
  },

  {
    id: 'caja-cerrar',
    titulo: 'Cerrar la caja (arqueo)',
    descripcion: 'Contar el cajón al final del turno y entender el descuadre.',
    minutos: 5,
    esencial: true,
    ruta: '/caja',
    pasos: () => [
      tarjeta(
        'Cerrar la caja',
        'Lo último del turno. Consiste en <strong>contar el dinero que hay</strong> y compararlo con lo que debería haber.',
      ),
      paso('[data-guia="caja-efectivo"]', 'Lo que debería haber', 'El programa lo calcula solo: fondo inicial + lo cobrado en efectivo + entradas − salidas.<br><br>Las tarjetas no salen aquí: ese dinero no pasa por el cajón, va directo al banco.', 'right'),
      paso('[data-guia="caja-movimientos"]', 'Entradas y salidas', 'Si durante el turno sacaste dinero para comprar hielo o pagar algo, tiene que estar apuntado aquí. Si no, al cerrar faltará y no sabrás por qué.', 'top'),
      paso('[data-guia="caja-cerrar"]', 'Cerrar caja (Z)', 'Se abre el arqueo. No deja cerrar si queda alguna mesa sin cobrar.', 'bottom'),
      tarjeta(
        'El arqueo',
        'Sacas el dinero y lo cuentas <strong>por tipo</strong>: cuántos billetes de 50, cuántos de 20, cuántas monedas de 2 €…<br><br>Se cuenta por tipo y no un total a ojo porque así se encuentran los fallos. Si falta un billete de 20, lo ves; si sumas mentalmente, no.',
      ),
      tarjeta(
        'El descuadre',
        'El programa compara lo contado con lo que debería haber:<br><br>• <strong>0,00 €</strong> → perfecto.<br>• <strong>En rojo (falta)</strong> → un cambio mal dado, o una salida sin apuntar.<br>• <strong>En ámbar (sobra)</strong> → un cobro no registrado, o un cambio de menos a un cliente.<br><br>Unos céntimos son normales. De varios euros, avisa al encargado.',
      ),
      tarjeta(
        'Muy importante',
        'El descuadre <strong>se apunta como sea</strong>, no se maquilla. Un cierre con 3 € de menos anotado no es un problema; uno cuadrado a la fuerza esconde el fallo y nadie lo puede arreglar.<br><br>Usa las <strong>notas del cierre</strong> para explicar lo que sepas: "se devolvió un cobro", "faltó cambio".',
      ),
      tarjeta(
        'Después de cerrar',
        'La caja queda guardada con tu nombre, la hora y el desglose. Puedes consultarla luego en <strong>Cierres anteriores</strong>.<br><br>Y no olvides la <strong>copia de seguridad</strong> al apagar.',
      ),
    ],
  },

  {
    id: 'ludoteca',
    titulo: 'Juegos y cover',
    descripcion: 'Prestar juegos a las mesas y cobrar el acceso a la ludoteca.',
    minutos: 2,
    esencial: false,
    ruta: '/juegos',
    pasos: () => [
      tarjeta(
        'La ludoteca',
        'Lo que hace distinto a este local. Cada juego se presta a una mesa y vuelve solo al cobrar.',
      ),
      paso('[data-guia="juegos-filtros"]', 'Encontrar un juego', 'Un cliente te dice "somos 5 y tenemos una hora". Filtras por jugadores y duración y le das tres opciones.', 'bottom'),
      paso('[data-guia="juegos-lista"]', 'La ficha', 'Jugadores, duración, dificultad y en qué estante está. Eso último te ahorra dar vueltas.', 'bottom'),
      tarjeta(
        'El cover',
        '<strong>4 € por persona</strong> si consumen, <strong>7 € por persona</strong> si solo vienen a jugar.<br><br>Se carga desde el pedido con el botón 🎲 Cover. Dilo al sentarles, no al cobrar: nadie quiere sorpresas en la cuenta.',
      ),
      tarjeta(
        'Al devolver',
        'Revisa que estén todas las piezas antes de marcarlo devuelto. Si falta algo, ponlo en estado <strong>Mantenimiento</strong> con una nota.',
      ),
    ],
  },

  {
    id: 'reservas',
    titulo: 'Reservas',
    descripcion: 'Apuntar una reserva por teléfono y sentar a la gente al llegar.',
    minutos: 2,
    esencial: false,
    ruta: '/reservas',
    pasos: () => [
      tarjeta('Reservas', 'Suena el teléfono y quieren mesa para el sábado. Esto es lo que haces.'),
      paso('[data-guia="reservas-dia"]', 'El día', 'Te mueves por fechas con las flechas. Hoy es lo que ves al entrar.', 'bottom'),
      paso('[data-guia="reservas-nueva"]', 'Nueva reserva', 'Nombre, teléfono, hora y cuántos son. Al elegir mesa, las que ya estén pilladas a esa hora salen en rojo: no te deja doblarlas.', 'left'),
      tarjeta(
        'Cuando llegan',
        'Botón <strong>Sentar</strong>: marca las mesas como ocupadas y abre el pedido con el número de personas ya puesto.<br><br>Si no aparecen, <strong>No vino</strong>. Así la mesa se libera y queda constancia.',
      ),
      tarjeta(
        'Un detalle',
        'Si pidieron un juego concreto, apúntalo en la reserva. Al llegar lo tienes localizado y quedas de maravilla.',
      ),
    ],
  },
];

export const guiaPorId = (id: string) => GUIAS.find((g) => g.id === id);
