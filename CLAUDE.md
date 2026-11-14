# Hotel Quinta Azul · sitio publicado (rama main)

Contexto para quien llegue a este repositorio, sea una persona o un asistente. Actualizado el 14 de noviembre de 2026.

## Qué hay en cada rama

- **`main` (esta rama): el sitio que está publicado hoy** en https://hotelquintaazul.com. Es la migración de Webflow a Astro, con su Worker de Cloudflare y el formulario de reservas. Sus comandos están en `README.md` y su bitácora en `VERIFICACION.md`.
- **`rediseno`: el rediseño completo del sitio, todavía sin publicar.** Es otro proyecto, con otro historial: un solo código que produce los dos hoteles (Quinta Azul y Los Arcos Inn). El mismo contenido está en la rama `rediseno` de `quintaazul/hotel-los-arcos`, y las dos se mantienen idénticas.

## Dónde se ve el rediseño

- Quinta Azul: https://prueba-quinta-azul.bijuu-nexo.workers.dev
- Los Arcos Inn: https://prueba-los-arcos.bijuu-nexo.workers.dev

Son copias de prueba, cerradas a buscadores. El dominio real sigue mostrando lo que hay en `main`.

## Reglas

- **Subir cambios a GitHub no publica nada.** No hay publicación automática: el sitio real solo cambia cuando alguien ejecuta a mano `npx wrangler deploy` desde `main`.
- **`main` y `rediseno` no se mezclan.** No comparten historial: nada de merge ni rebase entre ellas.
- **Para trabajar en el rediseño:** `git switch rediseno` y leer el `CLAUDE.md` de esa rama. Dice dónde está cada dato, cómo se hacen los cambios comunes (un precio, un horario, una pregunta, un artículo), qué revisar antes de terminar y qué decisiones de diseño no se reabren. Todo cambio del rediseño se sube a la rama `rediseno` de los dos repositorios.
- **Para corregir algo del sitio publicado hoy:** se trabaja en `main`, como hasta ahora.
- **El día que el rediseño pase al dominio real**, los pasos están en la rama `rediseno`: `servicio/LEEME.md` y la sección 12 de `docs/LISTA-DEL-BRIEF.md`. Se hace solo cuando el dueño lo pida.
- El repositorio es público: nunca lleva datos personales de huéspedes ni claves.

## Qué falta del rediseño

En la rama `rediseno`: `docs/PREGUNTAS-Y-CONTENIDO-PENDIENTE.md` (preguntas para el hotel, fotos que faltan y textos por escribir) y `docs/LISTA-DEL-BRIEF.md` (todo lo hecho y lo pendiente).
