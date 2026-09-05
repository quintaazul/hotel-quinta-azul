# Hotel Quinta Azul

Sitio estatico en Astro. Migrado desde Webflow (agosto 2026).
Repo independiente por decision de arquitectura: este hotel y Los Arcos
evolucionan por separado.

## Comandos
    npm run dev      # servidor local
    npm run build    # compila + corre la verificacion SEO
    npm run seo      # solo la verificacion SEO sobre dist/

## Estructura
    _baseline/   HTML en vivo de Webflow + su CSS compilado. Referencia de
                 fidelidad para el port. NO se despliega.
    src/styles/  capa de utilidades portada de Webflow (Relume/Client-First).
                 Es andamio desechable: se tira en el rediseno, no se refactoriza.
    src/content/ contenido en JSON. Fuente unica: alimenta el texto visible
                 Y el schema, para que no puedan contradecirse.
    functions/   endpoint del formulario (Cloudflare).

## Reglas
- El build falla si una pagina se queda sin title, meta description,
  canonical, lang, o con una imagen sin alt. Ver scripts/seo-check.mjs.
- Las rutas actuales no se tocan: / /hospedaje /celebraciones /ubicacion /contacto
