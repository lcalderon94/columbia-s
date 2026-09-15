# Tablets de cocina y barra

La idea: dos tablets colgadas, una en cocina y otra en barra, mostrando solo
las comandas que le tocan a cada una. Cuando el camarero pulsa **Enviar** en el
mostrador, la comanda aparece en la tablet **en menos de un segundo**, sin que
nadie toque nada.

## Qué hace falta

- El PC del mostrador con Columbia's arrancado (`ARRANCAR.bat`).
- Dos tablets, Android o iPad. Valen tablets baratas: solo enseñan una web.
- Que las tablets y el PC estén **en el mismo wifi**.

No hace falta instalar nada en las tablets.

## 1. Averiguar la dirección del PC

Arranca `ARRANCAR.bat` y mira la ventana negra. Escribe algo así:

```
  ===============================================
    Columbia's en marcha
  ===============================================

    En este PC:        http://localhost:4000
    En las tablets:    http://192.168.1.50:4000

    (las tablets tienen que estar en el mismo wifi)
```

Esa segunda dirección (**la tuya será distinta**) es la que se teclea en las
tablets.

> **Fija esa dirección en el router.** Si el PC cambia de IP al reiniciar, las
> tablets dejan de encontrarlo. En tu router, busca *DHCP reservado* o *IP
> estática* y ata esa IP al PC. Es cinco minutos una vez y te ahorra un susto
> un viernes noche.

## 2. Preparar la tablet de cocina

1. Abre Chrome en la tablet y entra en `http://192.168.1.50:4000`.
2. Entra con el **PIN de Cocina** (`4444` de fábrica; cámbialo).
3. Va sola a la pantalla de cocina. Esa cuenta no puede ver caja, facturas ni
   informes, ni la recaudación del día: solo comandas.
4. Pulsa **⛶ Pantalla completa**.

En la tablet de barra, igual pero con el **PIN de Barra** (`5555`).

La sesión aguanta semanas: no hay que volver a meter el PIN cada día.

## 3. Que no se apague la pantalla

Este es el ajuste que más importa y **se hace en la tablet, no en el programa**.

**Android:** Ajustes → Pantalla → *Tiempo de espera de la pantalla* → el máximo
(o «Nunca» si aparece). Añade Ajustes → Pantalla → *Brillo adaptativo*: apágalo,
para que no se oscurezca sola en una cocina con mucha luz.

**iPad:** Ajustes → Pantalla y brillo → *Bloqueo automático* → **Nunca**.

Columbia's intenta además impedir la suspensión por su cuenta, pero esa función
del navegador solo está disponible en conexiones seguras (https), y en el local
se entra por http. Por eso manda el ajuste de la tablet.

**Y déjalas enchufadas.** Una pantalla encendida todo el servicio se come la
batería en unas horas.

## 4. Modo quiosco de verdad (opcional)

Con pantalla completa basta para empezar. Si quieres que la tablet **no pueda
salir** de la aplicación —útil si hay mucha gente cerca—:

**Android, sin instalar nada:** Ajustes → Seguridad → *Fijar aplicación* (o
*Anclaje de pantalla*). Actívalo, abre Chrome con Columbia's y fija la app.
Para salir hay que mantener pulsado Atrás + Inicio.

**Android, más completo:** aplicaciones de quiosco como *Fully Kiosk Browser*
permiten poner la dirección de inicio, arrancar al encender la tablet, mantener
la pantalla siempre activa y bloquear la barra de navegación. Es la opción que
usan la mayoría de los locales.

**iPad:** Ajustes → Accesibilidad → *Acceso guiado*. Actívalo, abre la web y
pulsa tres veces el botón lateral. Pide un código para salir.

## 5. Añadir a la pantalla de inicio

Para que se abra con un icono, sin barra de navegador:

- **Android/Chrome:** menú ⋮ → *Añadir a pantalla de inicio*.
- **iPad/Safari:** botón compartir → *Añadir a pantalla de inicio*.

## Cómo se reparte el trabajo

No hay que configurar nada: cada producto sabe a dónde va por su categoría.

| Va a **Cocina** | Va a **Barra** | No va a ninguna |
|---|---|---|
| Hamburguesas | Smoothies, Refrescos | Cover / Juegos |
| Focaccias | Cafés, Infusiones | |
| Para compartir | Cervezas, Vinos | |
| Postres | Combinados, Licores | |

Una comanda con hamburguesa y caña genera **dos tickets**: la hamburguesa en
cocina y la caña en barra, cada una con su tiempo. Ninguna pantalla ve lo de la
otra.

El cover de la ludoteca no molesta a nadie: se da por servido al enviarlo.

Si quieres cambiar a dónde va algo, se hace en **Ajustes → Carta** por
categoría.

## Los colores del tiempo

El borde de cada comanda avisa de la espera sin tener que leer nada:

| Borde | Espera |
|---|---|
| Gris | menos de 12 minutos |
| Ámbar | 12 minutos o más |
| Rojo | 20 minutos o más |

Arriba, junto al título, sale un aviso con la espera máxima cuando pasa de 15
minutos.

## Si algo falla

| Qué pasa | Qué mirar |
|---|---|
| La tablet no abre la página | ¿Está en el mismo wifi? ¿Sigue arrancado el PC? ¿Ha cambiado la IP del PC? |
| Las comandas tardan en salir | Llegan igualmente cada 20 segundos por seguridad. Si va siempre lento, mira la cobertura wifi en la cocina. |
| La tablet se apaga sola | El tiempo de espera de pantalla no está puesto a «Nunca» (punto 3). |
| No suena el aviso | Toca una vez la pantalla: los navegadores no dejan sonar hasta que alguien interactúa. El botón 🔔 de arriba lo activa y lo apaga. |
| Se ve la comanda pero no deja pulsar | Se entró con un PIN que no es de cocina ni de barra. Sal y vuelve a entrar. |

## Seguridad

Esto está pensado para la **red del local**, con las tablets y el PC en el mismo
wifi. No abras el puerto 4000 al exterior desde el router: no lleva cifrado
https, y expuesto a internet cualquiera podría entrar. Si algún día quieres
consultar las ventas desde casa, se hace con una VPN o poniendo https delante,
no abriendo el puerto.
