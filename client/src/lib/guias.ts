import * as c from './comprobaciones';

export interface Tarea {
  /** Lo que tiene que hacer el empleado para poder seguir. */
  instruccion: string;
  /** Mira la pantalla y dice si ya lo ha hecho. */
  comprobar: () => boolean;
}

export interface PasoGuia {
  elemento?: string;
  titulo: string;
  texto: string;
  lado?: 'top' | 'bottom' | 'left' | 'right';
  /** Si va, el paso no deja pasar hasta que se hace de verdad. */
  hazlo?: Tarea;
  /**
   * Descarta el paso si su elemento no está en pantalla al empezar la guía.
   * Para pasos que dependen del estado del local (el botón de abrir caja no
   * está si la caja ya está abierta). Los demás pasos NO se descartan: hay
   * elementos que aparecen a mitad de guía, como el campo de "entregado",
   * que solo sale al elegir efectivo.
   */
  soloSiExiste?: boolean;
}

export interface Guia {
  id: string;
  titulo: string;
  descripcion: string;
  minutos: number;
  esencial: boolean;
  ruta: string;
  necesitaPedido?: boolean;
  /** El pedido de prácticas tiene que llegar con líneas ya puestas. */
  pedidoConLineas?: boolean;
  /**
   * Exige un pedido recién abierto y vacío. Si no, al reutilizar uno de una
   * práctica anterior las tareas ya estarían cumplidas y la guía se saltaría
   * sus propios pasos sin que el empleado tocara nada.
   */
  pedidoVacio?: boolean;
  pasos: (contexto: { pedidoId?: string }) => PasoGuia[];
}

const p = (
  elemento: string | undefined,
  titulo: string,
  texto: string,
  lado: PasoGuia['lado'] = 'bottom',
  hazlo?: Tarea,
): PasoGuia => ({ elemento, titulo, texto, lado, hazlo });

/** Tarjeta centrada, sin señalar nada: para introducir o cerrar. */
const t = (titulo: string, texto: string): PasoGuia => ({ titulo, texto });

export const GUIAS: Guia[] = [
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    descripcion: 'Qué es cada pantalla y cómo moverte por el programa.',
    minutos: 2,
    esencial: false,
    ruta: '/sala',
    pasos: () => [
      t(
        "Bienvenido a Columbia's",
        'Esta guía solo mira. Las siguientes te van a hacer trabajar: no avanzan hasta que hagas lo que te piden, que es la única forma de que se te quede.',
      ),
      p('[data-guia="menu"]', 'El menú', 'Todo está aquí. Solo ves lo que tu puesto necesita.', 'right'),
      p('[data-guia="menu-sala"]', 'Sala', 'El plano del local. Todo empieza aquí: se toca una mesa y se abre su pedido.', 'right'),
      p('[data-guia="menu-caja"]', 'Caja', 'Abrir al empezar el turno y cerrar al acabar. Sin caja abierta no se cobra en efectivo.', 'right'),
      p('[data-guia="cabecera"]', 'Cómo va el día', 'Venta, mesas ocupadas y comandas esperando en cocina.', 'bottom'),
      p('[data-guia="usuario"]', 'Tu sesión', 'Todo lo que hagas queda a tu nombre. Sal siempre al acabar tu turno.', 'left'),
      t('Ya está', 'Sigue con <strong>Tomar una comanda</strong>. Esa ya la haces tú.'),
    ],
  },

  {
    id: 'sala',
    titulo: 'La sala y las mesas',
    descripcion: 'Leer el plano y saber qué significa cada color.',
    minutos: 2,
    esencial: false,
    ruta: '/sala',
    pasos: () => [
      t('El plano de la sala', 'Cada tarjeta es una mesa. El color te dice su estado sin leer nada.'),
      p('[data-guia="zonas"]', 'Las zonas', 'Sala, Zona de juego, Terraza y Barra. El número dice cuántas están ocupadas.', 'bottom'),
      p('[data-guia="mesa"]', 'Una mesa', 'Blanca está libre. Al tocarla eliges cuántos son y se abre el pedido.', 'right'),
      p('[data-guia="leyenda"]', 'Los colores', 'Ámbar = ocupada, con su importe. Azul = reservada. Violeta = por limpiar.', 'bottom'),
      t(
        'Una mesa ocupada',
        'Si tocas una mesa que ya tiene pedido, entras directo a su comanda. Nunca se abren dos cuentas en la misma mesa.',
      ),
    ],
  },

  {
    id: 'comanda',
    titulo: 'Tomar una comanda',
    descripcion: 'La haces tú: bebida, comida y enviarla a cocina.',
    minutos: 5,
    esencial: true,
    ruta: '/pedido',
    necesitaPedido: true,
    pedidoVacio: true,
    pasos: () => [
      t(
        'Vamos a comandar de verdad',
        'Estás en un pedido de <strong>prácticas</strong>: no cuenta como venta y se borra al terminar.<br><br>A partir de aquí la guía <strong>no avanza sola</strong>. Cada paso espera a que lo hagas.',
      ),
      p(
        '[data-guia="buscador"]',
        'Busca la bebida',
        'El buscador filtra la carta entera. Es más rápido que ir por pestañas.',
        'bottom',
        {
          instruccion: 'Escribe <strong>caña</strong> en el buscador.',
          comprobar: c.buscadorDice('caña'),
        },
      ),
      p(
        '[data-guia="productos"]',
        'Añádela',
        'Un toque en el producto y entra en la comanda. Las bebidas entran directas, sin preguntar nada.',
        'right',
        {
          instruccion: 'Toca la <strong>Caña</strong> para añadirla.',
          comprobar: c.comandaTiene('caña'),
        },
      ),
      p(
        '[data-guia="buscador"]',
        'Limpia la búsqueda',
        'Mientras haya algo escrito solo ves los resultados: las pestañas de categorías están escondidas. Vacía el buscador para que vuelvan.',
        'bottom',
        {
          instruccion: 'Borra lo que hay en el buscador.',
          comprobar: c.buscadorVacio,
        },
      ),
      p(
        '[data-guia="categorias"]',
        'Ahora la comida',
        'Ya tienes otra vez la carta por categorías: arriba la comida, abajo las bebidas. Al entrar siempre sale abierta <strong>Hamburguesas</strong>.',
        'bottom',
      ),
      p(
        '[data-guia="productos"]',
        'La comida sí pregunta',
        'Al tocar una hamburguesa se abre el selector: punto de la carne, tipo de pan, quitar ingredientes y extras. Elige lo que haga falta y dale a <strong>Añadir</strong>.',
        'right',
        {
          instruccion: 'Añade una hamburguesa cualquiera, con su punto y su pan.',
          comprobar: c.comandaTieneAlguno(['classic', 'goat', 'pork', 'hot', 'crunchicken', 'kids', 'veggie']),
        },
      ),
      p(
        '[data-guia="comanda"]',
        'Una nota para cocina',
        'El botón <strong>⋯</strong> de cada línea pone una nota. Sale en amarillo en el ticket de cocina: es donde van las alergias y los cambios.',
        'left',
        {
          instruccion: 'Ponle una nota a una línea. Por ejemplo: <em>sin cebolla</em>.',
          comprobar: c.lineaConNota,
        },
      ),
      p(
        '[data-guia="cover"]',
        'El cover de la ludoteca',
        '4 € por persona si consumen, 7 € si solo vienen a jugar. Dilo al sentarles, nunca al cobrar.',
        'bottom',
        {
          instruccion: 'Añade el cover <strong>Consumiendo</strong>.',
          comprobar: c.comandaTiene('cover'),
        },
      ),
      p(
        '[data-guia="enviar"]',
        'Envía la comanda',
        'Este es el botón importante: hasta que no lo pulses, cocina no ve nada.',
        'top',
        {
          instruccion: 'Pulsa <strong>Enviar</strong>.',
          comprobar: c.comandaEnviada,
        },
      ),
      t(
        'Ya está en cocina',
        'La hamburguesa ha ido a la pantalla de <strong>cocina</strong> y la caña a la de <strong>barra</strong>, cada una con su ticket. Tú no repartes nada.<br><br>Puedes seguir añadiendo y enviar otra ronda: se numeran solas.',
      ),
    ],
  },

  {
    id: 'cocina',
    titulo: 'Cocina y barra',
    descripcion: 'Cómo se lee la pantalla de producción.',
    minutos: 2,
    esencial: false,
    ruta: '/cocina',
    pasos: () => [
      t('La pantalla de cocina', 'Tres columnas y nada más. Se lee de izquierda a derecha.'),
      p('[data-guia="kds-columnas"]', 'Las tres columnas', 'Nuevas → En marcha → Listas para servir. Cada comanda avanza con un toque.', 'bottom'),
      p('[data-guia="kds-resumen"]', 'El resumen', 'Cuántas hay en cada estado y cuánto lleva esperando la más antigua.', 'bottom'),
      t(
        'Los colores del tiempo',
        '• <strong>Gris</strong>: menos de 12 minutos<br>• <strong>Ámbar</strong>: 12 o más<br>• <strong>Rojo</strong>: 20 o más<br><br>Las notas del camarero salen en amarillo: son alergias o cambios. Léelas siempre.',
      ),
      p('[data-guia="kds-pantalla"]', 'Pantalla completa', 'Para dejar la tablet fija en esta vista, colgada en la pared.', 'left'),
    ],
  },

  {
    id: 'cobro',
    titulo: 'Cobrar una cuenta',
    descripcion: 'La cobras tú: efectivo, cambio, tarjeta y factura.',
    minutos: 7,
    esencial: true,
    ruta: '/cobro',
    necesitaPedido: true,
    pedidoConLineas: true,
    pasos: () => [
      t(
        'Vamos a cobrar de verdad',
        'Sigues en <strong>prácticas</strong>: no se cobra dinero ni se emite factura.<br><br>Otra vez, la guía no avanza hasta que hagas cada cosa.',
      ),
      p('[data-guia="cobro-cuenta"]', 'La cuenta', 'Lo que ha consumido la mesa. Repásala con el cliente antes de cobrar.', 'right'),
      p('[data-guia="cobro-total"]', 'El total', 'El precio ya lleva el IVA dentro. La base y la cuota son para la gestoría, no para el cliente.', 'right'),
      p(
        '[data-guia="cobro-metodos"]',
        'Cómo va a pagar',
        'Lo primero de todo. Vamos a empezar por efectivo, que es donde más se falla.',
        'bottom',
        {
          instruccion: 'Elige <strong>Efectivo</strong>.',
          comprobar: c.metodoElegido('EFECTIVO'),
        },
      ),
      p(
        '[data-guia="cobro-entregado"]',
        'Lo que te da el cliente',
        'Aquí va lo que te entrega, no lo que cuesta. Hay botones rápidos de 5, 10, 20 y 50 €.',
        'bottom',
        {
          instruccion: 'Escribe lo que te daría el cliente, más que el total. Prueba con <strong>50</strong>.',
          comprobar: c.entregadoEscrito,
        },
      ),
      p(
        '[data-guia="cobro-cambio"]',
        'El cambio, calculado',
        'Ahí lo tienes en verde. <strong>No eches cuentas de cabeza</strong>: es de donde salen la mitad de los descuadres al cerrar caja.',
        'bottom',
      ),
      t(
        'Si paga con tarjeta',
        'La tarjeta se pasa por el <strong>datáfono</strong>, que va aparte. Cuando salga su recibo, copia el <strong>número de autorización</strong> y los <strong>cuatro últimos dígitos</strong>.<br><br>Parece una tontería, pero es lo que te salva si al día siguiente hay que buscar un cobro o un cliente reclama.',
      ),
      p(
        '[data-guia="cobro-parcial"]',
        'Si pagan a medias',
        'Pones el importe del primero, <strong>Añadir cobro parcial</strong>, y luego el del segundo con su forma de pago. Uno en efectivo y otro con tarjeta: sin problema.',
        'top',
      ),
      p('[data-guia="cobro-dividir"]', 'A partes iguales', 'Reparte lo pendiente entre los que sean, sin perder un céntimo.', 'top'),
      p(
        '[data-guia="cobro-factura"]',
        'Ticket o factura',
        'Por defecto sale el <strong>ticket</strong>, que vale para casi todo el mundo. Si piden <strong>factura</strong> a nombre de una empresa, cambia aquí y pide el NIF: sin NIF no se puede emitir.',
        'top',
      ),
      p(
        '[data-guia="cobro-boton"]',
        'Y a cobrar',
        'Cuando todo cuadre. Se cierra la cuenta y la mesa queda por limpiar.',
        'top',
        {
          instruccion: 'Pulsa <strong>Cobrar</strong> para terminar.',
          comprobar: c.cobroTerminado,
        },
      ),
      t(
        'Si te equivocas',
        'Mientras no haya factura emitida, un cobro mal metido se anula desde el pedido.<br><br>Si ya hay factura, <strong>no se borra nunca</strong>: se emite una rectificativa, y eso lo hace un encargado. Avisa y no lo arregles por tu cuenta.',
      ),
    ],
  },

  {
    id: 'caja-abrir',
    titulo: 'Abrir la caja',
    descripcion: 'Lo primero del turno. Sin esto no se cobra en efectivo.',
    minutos: 2,
    esencial: true,
    ruta: '/caja',
    pasos: () => [
      t(
        'Abrir caja',
        'Es lo primero al llegar, antes de que entre nadie. Si no, el primer cliente que pague en efectivo te da un aviso.',
      ),
      {
        elemento: '[data-guia="caja-abrir"]',
        titulo: 'Se abre aquí',
        texto: 'Solo puede haber una caja abierta a la vez.',
        lado: 'bottom',
        soloSiExiste: true,
        hazlo: {
          instruccion: 'Pulsa <strong>Abrir caja</strong>.',
          comprobar: () =>
            document.body.textContent?.includes('Fondo de caja inicial') === true,
        },
      },
      t(
        'El fondo de caja',
        'El dinero que dejas en el cajón <strong>para dar cambios</strong>, normalmente 150 €. No es una venta: es lo que ya había.<br><br><strong>Cuéntalo antes de escribirlo.</strong> Si pones un número que no es, al cerrar te saldrá un descuadre que no existe.',
      ),
      {
        elemento: '[data-guia="caja-efectivo"]',
        titulo: 'Ya está abierta',
        texto: 'A partir de ahora cada cobro en efectivo se anota solo. Tú no apuntas nada.',
        lado: 'right',
        soloSiExiste: true,
      },
      t(
        'Durante el turno',
        'Si sacas dinero para comprar hielo o pagar algo, <strong>apúntalo</strong> en Entrada / salida. Si no, al cerrar faltará y no sabrás por qué.',
      ),
    ],
  },

  {
    id: 'caja-cerrar',
    titulo: 'Cerrar la caja (arqueo)',
    descripcion: 'Practicas el arqueo con un cajón de mentira hasta cuadrarlo.',
    minutos: 6,
    esencial: true,
    ruta: '/formacion',
    pasos: () => [
      t(
        'Cerrar la caja',
        'Lo último del turno: <strong>contar el dinero</strong> y compararlo con lo que debería haber.<br><br>No vamos a cerrar la caja de verdad: practicarás con un <strong>cajón de mentira</strong> hasta que te salga.',
      ),
      t(
        'Cómo se cuenta',
        'Por <strong>tipo</strong>: cuántos billetes de 50, cuántos de 20, cuántas monedas de 2 €…<br><br>No se suma a ojo porque así se encuentran los fallos: si falta un billete de 20 lo ves, y sumando de cabeza no.',
      ),
      p(
        '[data-guia="sim-abrir"]',
        'El simulador',
        'Un cajón de mentira. No toca la caja real ni guarda nada: puedes equivocarte todo lo que quieras.',
        'top',
        {
          instruccion: 'Abre el <strong>simulador de arqueo</strong>.',
          comprobar: c.simuladorAbierto,
        },
      ),
      p(
        '[data-guia="sim-contar"]',
        'Cuenta el cajón',
        'Arriba tienes lo que debería haber. Mete billetes y monedas y mira qué pasa.',
        'top',
        {
          instruccion: 'Mete unas cuantas unidades de cualquier billete.',
          comprobar: c.simuladorContado,
        },
      ),
      p(
        '[data-guia="sim-resultado"]',
        'El descuadre',
        '<strong>En rojo</strong> falta dinero: un cambio mal dado o una salida sin apuntar.<br><strong>En ámbar</strong> sobra: un cobro sin registrar o cambio de menos a un cliente.',
        'top',
      ),
      p(
        '[data-guia="sim-contar"]',
        'Ahora cuádralo',
        'Ajusta los billetes y monedas hasta que el descuadre sea <strong>0,00 €</strong>. Es exactamente lo que harás cada noche.',
        'top',
        {
          instruccion: 'Deja el descuadre en <strong>0,00 €</strong>.',
          comprobar: c.simuladorCuadrado,
        },
      ),
      t(
        'Lo más importante de todo',
        'En la caja de verdad, <strong>el descuadre se apunta como sea</strong>, nunca se maquilla.<br><br>Un cierre con 3 € de menos anotado no es un problema. Uno cuadrado a la fuerza esconde el fallo y ya nadie lo puede arreglar.<br><br>Unos céntimos son normales. De varios euros, avisa al encargado y escríbelo en las <strong>notas del cierre</strong>.',
      ),
      t(
        'Y al terminar',
        'La caja queda guardada con tu nombre, la hora y el desglose, y se consulta en <strong>Cierres anteriores</strong>.<br><br>No olvides la <strong>copia de seguridad</strong> al apagar el ordenador.',
      ),
    ],
  },

  {
    id: 'ludoteca',
    titulo: 'Juegos y cover',
    descripcion: 'Buscar un juego para una mesa y prestarlo.',
    minutos: 3,
    esencial: false,
    ruta: '/juegos',
    pasos: () => [
      t('La ludoteca', 'Lo que hace distinto a este local. Cada juego se presta a una mesa y vuelve solo al cobrar.'),
      p(
        '[data-guia="juegos-filtros"]',
        'Encontrar un juego',
        'Un cliente te dice "somos 5 y tenemos una hora". Filtras y le das opciones sin dar vueltas por la estantería.',
        'bottom',
        {
          instruccion: 'Filtra por <strong>5 jugadores</strong>.',
          comprobar: () => {
            const selects = document.querySelectorAll('[data-guia="juegos-filtros"] select');
            return [...selects].some((s) => (s as HTMLSelectElement).value === '5');
          },
        },
      ),
      p('[data-guia="juegos-lista"]', 'La ficha', 'Jugadores, duración, dificultad y en qué estante está. Lo último te ahorra el paseo.', 'bottom'),
      t(
        'El cover',
        '<strong>4 € por persona</strong> si consumen, <strong>7 €</strong> si solo juegan. Se carga desde el pedido con el botón 🎲 Cover.<br><br>Dilo al sentarles, no al cobrar: nadie quiere sorpresas en la cuenta.',
      ),
      t(
        'Al devolver',
        'Revisa que estén todas las piezas antes de marcarlo devuelto. Si falta algo, ponlo en <strong>Mantenimiento</strong> con una nota.',
      ),
    ],
  },

  {
    id: 'reservas',
    titulo: 'Reservas',
    descripcion: 'Apuntar una reserva y sentar a la gente al llegar.',
    minutos: 3,
    esencial: false,
    ruta: '/reservas',
    pasos: () => [
      t('Reservas', 'Suena el teléfono y quieren mesa para el sábado. Esto es lo que haces.'),
      p('[data-guia="reservas-dia"]', 'El día', 'Te mueves por fechas con las flechas. Al entrar ves hoy.', 'bottom'),
      p(
        '[data-guia="reservas-nueva"]',
        'Apuntarla',
        'Nombre, teléfono, hora y cuántos son.',
        'left',
        {
          instruccion: 'Abre <strong>Nueva reserva</strong>.',
          comprobar: () => document.body.textContent?.includes('Nombre del cliente') === true,
        },
      ),
      t(
        'Las mesas ocupadas salen en rojo',
        'Al elegir mesa, las que ya estén pilladas a esa hora aparecen en rojo y no te deja cogerlas. No puedes doblar una mesa por error.<br><br>Puedes cerrar el formulario sin guardar.',
      ),
      t(
        'Cuando llegan',
        'Botón <strong>Sentar</strong>: marca las mesas ocupadas y abre el pedido con las personas ya puestas.<br><br>Si no aparecen, <strong>No vino</strong>: libera la mesa y queda constancia.',
      ),
      t('Un detalle', 'Si pidieron un juego concreto, apúntalo en la reserva. Al llegar lo tienes localizado y quedas de maravilla.'),
    ],
  },
];

export const guiaPorId = (id: string) => GUIAS.find((g) => g.id === id);
