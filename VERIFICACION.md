# Verificacion de la Fase 1 — Hotel Quinta Azul

Medido el 5-sep-2026 contra https://hotelquintaazul.com en vivo.

## Fidelidad visual: altura de pagina y de cada seccion

Se compara la altura de cada seccion y de la pagina completa en tres anchos.
Una coincidencia exacta significa que tipografias, espaciados, imagenes y
saltos de linea caen en el mismo sitio.

| Pagina        | Ancho  | Webflow | Astro  | Diferencia |
|---------------|--------|---------|--------|------------|
| home          | 1425px | 12470   | 12470  | 0          |
| home          | 753px  | 15068   | 15068  | 0          |
| home          | 375px  | 14579   | 14579  | 0          |
| hospedaje     | 1425px | 8928    | 8928   | 0          |
| celebraciones | 1425px | 6529    | 6529   | 0          |
| ubicacion     | 1425px | 6647    | 6647   | 0          |
| contacto      | 1425px | 6042    | 6040   | -2         |

Secciones individuales: 12/12 iguales en la home (en los tres anchos),
7/7 en hospedaje, 6/6 en celebraciones y ubicacion, 5/6 en contacto.

**La unica diferencia del sitio son 2 px**, en el desplegable "Tipo de
habitacion" de contacto: 43 px en Webflow, 41 px aqui. El marcado y el CSS
son identicos byte a byte, asi que es una diferencia de como el navegador
dibuja un `<select>` nativo. Imperceptible y sin efecto funcional.

## Hallazgo durante el port: una fuente distinta cambiaba el diseno

Al principio dos secciones de la home quedaban 124 px y 52 px mas bajas.
La causa: se cargaban las fuentes con la API v2 de Google Fonts, que sirve
Fraunces como fuente variable, con metricas mas estrechas que la version
estatica que usa Webflow (API v1). Con la v2, "Atencion personal por
WhatsApp" ocupaba 2 lineas en vez de 3.

Solucion: cargar las fuentes con la MISMA API v1 que Webflow. Tras el
cambio, las 12 secciones coinciden exactamente. Esta anotado en
`src/layouts/Base.astro` para que nadie lo "modernice" sin querer.

## Accesibilidad (axe-core, WCAG 2.2 AA)

| Pagina                | Violaciones |
|-----------------------|-------------|
| Astro / (home)        | 0           |
| Astro /hospedaje      | 0           |
| Astro /celebraciones  | 0           |
| Astro /ubicacion      | 0           |
| Astro /contacto       | 0           |
| **Webflow en vivo /** | **2 graves**|

Las de Webflow: falta el atributo `lang` en `<html>`, y dos enlaces sin
texto reconocible (los logos de la barra y del pie, con alt vacio).

## Otras comprobaciones

- Build: correcto, 5 paginas.
- Verificacion SEO propia: pasa en las 5 (lang, title, description,
  og:title/description/image, canonical, alt no vacio, un solo h1 sin saltos
  de nivel, JSON-LD valido, sin jQuery).
- Comparador estructural: 5/5 paginas sin diferencias en encabezados, texto,
  enlaces, imagenes, secciones y metadatos.
- Enlaces y recursos: 32 rutas internas, todas responden 200.
- Consola del navegador: sin errores.
- Sin scroll horizontal en movil.
- Menu movil: abre, cierra, responde a Escape y expone `aria-expanded`.
- Pestanas: cambian con clic y con las flechas del teclado, con roles ARIA.
- Cero jQuery y cero llamadas al CDN de Webflow en el build.

## Imagenes: verificacion contra el CDN

De las 20 imagenes que usa el sitio en vivo: 17 identicas byte a byte a las
rescatadas, 2 solo estaban renombradas, y **1 faltaba** — el logo de la barra
de navegacion. Se bajo del CDN (298x213) y se anadio tambien al juego maestro
de `Downloads\Assets-Hoteles-Garcia`, que estaba incompleto.

---

# Fase 2 — Formulario, correo, anti-spam y base de datos

Medido el 5-sep-2026 con el Worker corriendo en local (`wrangler dev`).

## Comportamiento del formulario

| Caso | Respuesta | Correcto |
|------|-----------|----------|
| Solicitud completa y valida | 200, guardada, correo enviado | si |
| Sin token de Turnstile | 403, no se guarda | si |
| Faltan campos obligatorios | 400 con la lista de lo que falta | si |
| Sin aceptar el aviso de privacidad | 400 | si |
| Tipo de habitacion y motivo inventados | 200, pero los valores se descartan | si |
| Numero de personas = 99999 | 200, se guarda como vacio (tope 200) | si |
| `<script>alert(1)</script>` en un campo | descartado por la lista blanca | si |
| `Roberto'); DROP TABLE solicitudes;--` | guardado como texto, tabla intacta | si |
| Envio real desde el navegador | 200, mensaje de exito, guardado | si |

## Como se guarda ahora un lead

Antes (Webflow), un lead real llegaba asi:

    Contact 6 First Name: Blanca
    Contact 6 Last Name:  bcastilr@hotmail.com     <- el correo, en "apellido"
    Contact 6 Email:      19 al 20                 <- las fechas, en "correo"
    Contact 6 Phone:      8                        <- las personas, en "telefono"
    Contact 6 Select:     Second                   <- "doble"

Ahora:

    nombre:      Blanca Castillo
    contacto:    bcastilr@hotmail.com
    fechas:      19 al 20 de septiembre
    personas:    8
    habitacion:  sencilla
    motivo:      hospedaje
    mensaje:     Somos ocho personas, queremos dos noches

## Fidelidad visual tras reconstruir el formulario

| Pagina    | Ancho  | Webflow | Astro | Diferencia |
|-----------|--------|---------|-------|------------|
| contacto  | 1425px | 6042    | 6042  | 0          |
| home      | 1425px | 12470   | 12470 | 0          |
| home      | 753px  | 15068   | 15068 | 0          |
| home      | 375px  | 14579   | 14579 | 0          |

El desplegable de contacto ya no descuadra: al portar el CSS que faltaba
(ver abajo) la pagina quedo exacta.

## Accesibilidad (axe-core, WCAG 2.2 AA)

0 violaciones en las 6 paginas, incluida la nueva 404 y el formulario nuevo.

## Errores encontrados y corregidos

1. **Faltaba CSS del original.** Webflow inyecta 6 KB de estilos EN LINEA en
   cada pagina, aparte de sus archivos .css. No se habian portado. El efecto:
   los enlaces del pie salian casi negros sobre el azul (contraste 2.64, muy
   por debajo del minimo) porque falta la regla que los hace heredar el color.
   Se detecto con axe. Ya portado en `src/styles/webflow-inline.css`.

2. **El aviso por correo fallaba si la persona dejaba un correo electronico.**
   La cabecera Reply-To exige un objeto `Mailbox` de mimetext; con una cadena
   lanza `MIMETEXT_INVALID_HEADER_VALUE` y el aviso entero no sale.

3. **El widget anti-spam empujaba la pagina 162 px.** Resuelto con
   `appearance="interaction-only"` (invisible salvo ante trafico sospechoso) y
   moviendolo dentro de un bloque existente: el formulario es una rejilla con
   separacion de 24 px y un hijo mas se llevaba una separacion entera.

4. **Los mensajes ocultos ocupaban espacio.** El CSS de Webflow declara
   `display` en `.w-form-done` y `.w-form-fail`, lo que gana al atributo
   `hidden`. Corregido en `migracion.css`.

## Limitaciones de la prueba local

- **El correo NO se envio de verdad.** En local, wrangler simula el envio y lo
  imprime en la consola. Que aparezca `correo_ok = 1` significa que el mensaje
  se construyo bien, no que llegara a una bandeja. El envio real solo se puede
  comprobar tras el despliegue.
- **Turnstile corrio con claves de prueba.** No ejecutan el desafio real, asi
  que devuelven `success` sin `action` ni `hostname`. Las comprobaciones
  estrictas de esos dos campos solo se pueden verificar en produccion.

---

# Auditoria previa a la Fase 3

Medido el 10-sep-2026 contra https://hotelquintaazul.com en vivo. Paginas:
home, hospedaje, celebraciones, ubicacion, contacto y 404. Anchos: 1920,
1440, 1366, 1024, 768, 430, 390, 375 y 360 px.

## Animaciones de Webflow: inventario y estado

Se extrajeron las interacciones (IX2) del JavaScript que publica Webflow.
De 475 eventos, solo estos existen de verdad en el sitio; el resto son
restos de la plantilla Relume que apuntan a elementos que no existen.

| Donde | Animacion original | Pantallas | Antes de la auditoria | Ahora |
|-------|--------------------|-----------|-----------------------|-------|
| home, alberca | La foto pasa de 200% a 100% de ancho en 1.4 s al entrar en pantalla | desde 768 px | Sustituida por otra (aparecer desde abajo) y activa tambien en celular | Igual que Webflow |
| hospedaje, tarjetas | Al pasar el raton: tarjeta 50% a 70%, velo 0.5 a 0.7, aparece el texto | desde 992 px | Perdida: el texto se veia siempre | Igual |
| contacto, titulo | "Tu reserva comienza / aquí mismo" entran desde los lados con el scroll | desde 480 px | Perdida | Igual |
| contacto y ubicacion, preguntas | Acordeon que abre y cierra; el + gira 45 grados | todas | **Rota: las respuestas no se podian abrir** | Igual, y ahora tambien con teclado |
| menu movil | Baja desde la barra en 0.4 s | menos de 992 px | Aparecia de golpe | Igual |
| pestanas | La que se va se desvanece en 0.1 s, la nueva entra en 0.3 s | todas | Cambio de golpe | Igual |

Medido lado a lado con Webflow a 1366 px: tarjetas 592/592 a 687/497 px y de
vuelta (identico), foto 1216 a 608 px, acordeon 0 a 72 px con giro de 45
grados, titulo en -36%, -20% y 0% en los mismos puntos del scroll.
Quien activa "reducir movimiento" en su sistema ve el estado final sin
animacion (Webflow no lo respetaba).

## Menu movil abierto y orden del CSS

En celular y tablet el menu abierto se veia distinto: enlaces en una sola
linea, botones angostos y letra de 18 px en vez de 16. Dos causas:

1. Webflow marca el menu al abrirlo (`data-nav-menu-open` en el menu,
   `w--nav-link-open` en los enlaces) y su CSS depende de esas marcas. El
   script del menu ahora pone las mismas.
2. El CSS se cargaba en otro orden que en Webflow. Astro junta los estilos
   comunes a todas las paginas en un paquete y pone el CSS de cada pagina
   DESPUES, justo al reves que el original, donde los estilos en linea iban
   al final y ganaban los empates. Ahora cada pagina importa un solo archivo
   (`src/styles/orden-webflow/`) que encadena los cuatro en el orden de
   Webflow. Verificado en el build: general, pagina, en linea, arreglos.

## Comparacion completa: 6 paginas x 9 anchos

Para cada seccion se calcula una huella con el tamano, peso, interlineado,
color, alineacion, subrayado y ancho de cada texto, mas la altura total.

- **home, hospedaje, celebraciones y ubicacion:** identicas en los 9 anchos
  (como mucho 1 px de redondeo en la altura total).
- **contacto:** identica salvo 24 px de espacio bajo el boton "Enviar". Los
  agrega Webflow en vivo con dos contenedores vacios de su anti-spam; el
  5-sep la pagina media 6042 px en los dos lados.
- **404:** la de Webflow no carga sus estilos en linea ni sus fuentes (los
  enlaces del pie salen oscuros sobre el azul). La nuestra usa los estilos
  del resto del sitio. Diferencia intencional.
- **Menu movil abierto:** identico en los 5 anchos menores de 992 px.

## Corregido en esta auditoria

1. Animaciones perdidas o cambiadas (tabla de arriba) y acordeon roto.
2. Menu movil abierto distinto del original y orden del CSS invertido.
3. La imagen para redes sociales (`og:image`) daba 404: no existia el
   archivo. Creada en `public/og/` (1200x630) y el build ahora falla si falta.
4. Faltaba `robots.txt`. Creado, con la ruta del sitemap; el build lo exige.
5. La pagina de hospedaje todavia descargaba jQuery de un CDN externo.
   Eliminado; su efecto se reimplemento sin librerias.
6. La galeria de celebraciones: sus datos en Webflow estaban vacios y al
   hacer clic la pagina saltaba al inicio. Ahora abre la foto en un visor.
7. La etiqueta "¿Cuál es tu motivo de visita?" era un elemento en linea;
   ahora es de bloque, como el `<label>` original.
8. 6 errores de tipos de TypeScript heredados de la Fase 2 (0 ahora).

## Otras comprobaciones

- Accesibilidad (axe-core, WCAG 2.2 AA): 0 violaciones en las 6 paginas.
- `astro check`: 0 errores, 0 advertencias.
- Verificacion SEO propia: pasa en todas; comparador estructural 5/5.
- Enlaces y recursos: 32 rutas internas, todas responden 200.
- Sin scroll horizontal en ningun ancho, tampoco con la foto al 200%.
- Desplegado en https://hotel-quinta-azul.hotel-quinta-azul.workers.dev,
  version `35cac26a-527c-43d4-b4aa-ae5ee868de59`: mismos archivos que el
  build local, HTTPS, rutas 200, 404 real, robots, sitemap e imagen OG 200.
  Turnstile carga sin errores (en localhost da el error 110200 porque ese
  dominio no esta autorizado en el widget; es lo esperado).

---

# Fase 3: publicacion en hotelquintaazul.com

10-sep-2026, ~17:48 hora de Monterrey.

## Como se hizo

1. Zona de Cloudflare creada con copia exacta de los registros que servian a
   Webflow, en modo "solo DNS". Comprobado contra los nameservers de Cloudflare
   ANTES de tocar Porkbun: mismas respuestas.
2. Nameservers cambiados en Porkbun a `cameron` / `clarissa.ns.cloudflare.com`
   (DNSSEC estaba apagado, asi que el cambio no rompe nada). Zona activa en
   ~2 minutos. Hasta aqui el sitio seguia saliendo de Webflow.
3. Ensayo en dos subdominios de prueba (ya borrados): Cloudflare no deja
   conectar un Worker a un nombre que ya tiene registro, asi que el corte es
   borrar y conectar en el mismo segundo, con vuelta atras si falla.
4. Corte: `hotelquintaazul.com` al Worker del sitio y `www` al Worker de
   `redireccion-www/` (301 al dominio principal, conservando ruta y parametros).

## Verificado en vivo

- Las 5 paginas 200; `/no-existe` 404 real; robots, sitemap e imagen OG 200.
- `http://` y `www` redirigen con 301 a `https://hotelquintaazul.com`.
- `/api/contacto`: GET 405, POST sin verificacion de Turnstile 403.
- Sin jQuery ni recursos de Webflow. La copia en `*.workers.dev` esta apagada
  y ese hostname salio del widget de Turnstile y de `TURNSTILE_HOSTNAMES`.
- Email Routing activo (MX, SPF y DKIM de Cloudflare);
  `hotelquintaazul02@gmail.com` es destino verificado.
- 1.1.1.1, 8.8.8.8, 9.9.9.9 y OpenDNS ya entregan el sitio nuevo a los ~10
  minutos. Porkbun sigue respondiendo con los registros viejos a quien tenga
  la delegacion en cache (hasta 48 h), asi que Webflow NO debe cancelarse
  antes de unos dias.

## Defecto encontrado al publicar (se le escapo a la auditoria)

El canonical y `og:url` salian como `/contacto.html` e `/index.html`: con
`build.format: 'file'`, `Astro.url.pathname` trae el nombre del archivo, y esa
URL redirige (307) a la limpia. Un canonical que redirige. La verificacion SEO
solo miraba el dominio del canonical y lo dejo pasar. Corregido en
`Base.astro`, y `seo-check.mjs` ahora exige que canonical y `og:url` sean
exactamente la URL que se sirve (probado: contra el build anterior falla con
12 errores).

## Pendiente

- Envio real del formulario desde un telefono para confirmar que el correo
  llega (Turnstile bloquea a los navegadores automatizados).
- Permiso `Zone > Workers Routes > Edit` en el token: sin el, `wrangler deploy`
  sube el codigo pero termina en error al revisar las rutas.
- Web Analytics: un clic en el panel de Cloudflare.
- Cancelar el plan de Webflow despues de unos dias.
