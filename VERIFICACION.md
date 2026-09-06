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
