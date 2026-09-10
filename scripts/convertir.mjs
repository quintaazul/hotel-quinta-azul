#!/usr/bin/env node
/**
 * Convierte el <main> de una pagina de Webflow en marcado Astro.
 *
 * Conserva el HTML y las clases EXACTAS. Solo cambia lo que tiene que cambiar:
 *   - <img> del CDN de Webflow  ->  <Foto> (imagenes locales, responsive)
 *   - atributos internos de Webflow (data-w-id, data-wf-*)  ->  se eliminan
 *   - las pestañas  ->  mismas clases, con roles ARIA y JS propio
 *   - la interaccion IX2  ->  data-encoger
 *
 *   node scripts/convertir.mjs home > /tmp/main.astro
 */
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

const pagina = process.argv[2];
if (!pagina) {
  console.error('Uso: node scripts/convertir.mjs <home|hospedaje|celebraciones|ubicacion|contacto>');
  process.exit(1);
}

const $ = cheerio.load(readFileSync(`_baseline/${pagina}.html`, 'utf8'), { decodeEntities: false });
const main = $('.main-wrapper');
if (!main.length) throw new Error('No se encontro .main-wrapper');

const avisos = [];

/**
 * Textos alternativos que en Webflow quedaron vacios (defecto 11 de la
 * auditoria). Se corrigen aqui para que la correccion sobreviva a cada
 * regeneracion, en vez de editarse a mano en el .astro y perderse.
 */
/**
 * Los archivos rescatados del CDN se guardaron con nombres descriptivos.
 * Este mapa traduce el nombre que usa Webflow al nombre local.
 * Verificado byte a byte contra el CDN: 17 de 20 imagenes eran identicas,
 * 2 solo estaban renombradas, y el logo del navbar faltaba y se bajo aparte.
 */
const RENOMBRADOS = {
  'Hotel en Nuevo Leon Garcia, Mexico.webp': 'hero-hotel-quinta-azul-garcia-nuevo-leon.webp',
  'Mesa de trabajo 10.png': 'logo-quinta-azul-mesa-10.png',
  'Mesa de trabajo 12.png': 'logo-navbar-hotel-quinta-azul.png',
};

const ALT_FIJOS = {
  'Hotel en Nuevo Leon Garcia, Mexico.webp':
    'Alberca del Hotel Quinta Azul al atardecer, con la sierra de García al fondo',
};

// --- Imagenes: del CDN de Webflow a <Foto> ------------------------------
main.find('img').each((_, im) => {
  const $im = $(im);
  const src = decodeURIComponent(($im.attr('src') || '').split('/').pop() || '');
  const original = src.replace(/^[0-9a-f]{24}_/, '');
  const archivo = RENOMBRADOS[original] || original;
  let alt = $im.attr('alt');
  const clase = $im.attr('class') || '';
  const sizes = $im.attr('sizes');
  const eager = $im.attr('loading') === 'eager';

  if (alt === undefined || !alt.trim()) {
    if (ALT_FIJOS[original]) {
      alt = ALT_FIJOS[original];
      avisos.push(`alt vacio en Webflow, corregido desde ALT_FIJOS: ${original}`);
    } else {
      avisos.push(`ALT VACIO y sin correccion en ALT_FIJOS: ${original}`);
    }
  }

  const attrs = [
    `archivo="${archivo}"`,
    `alt="${(alt || '').replace(/"/g, '&quot;')}"`,
    clase && `class="${clase}"`,
    sizes && `sizes="${sizes}"`,
    eager && `loading="eager"`,
  ].filter(Boolean);

  // El parser pasa a minusculas los nombres de etiqueta, asi que <Foto> se
  // convertiria en <foto> y Astro no lo reconoceria como componente. Dejamos
  // un marcador y lo sustituimos al final, ya sobre el texto.
  $im.replaceWith(`<span data-foto="${Buffer.from(attrs.join(' ')).toString('base64')}"></span>`);
});

// --- Atributos internos de Webflow --------------------------------------
main.find('[data-w-id]').each((_, el) => {
  $(el).removeAttr('data-w-id');
  // La seccion de la alberca tenia una interaccion de revelado al hacer scroll.
  if (($(el).attr('class') || '').includes('_image-wrapper')) {
    $(el).attr('data-encoger', '');
  }
});
main.find('[data-wf-sku-bindings], [data-wf-bindings]').removeAttr('data-wf-sku-bindings').removeAttr('data-wf-bindings');

// --- Pestañas: mismas clases, ahora accesibles --------------------------
main.find('.w-tabs').each((ti, tabs) => {
  const $t = $(tabs);
  $t.attr('data-tabs', '');
  $t.find('.w-tab-menu').attr('role', 'tablist');
  $t.find('.w-tab-link').each((i, link) => {
    const id = `tab-${ti}-${i}`;
    const activo = ($(link).attr('class') || '').includes('w--current');
    $(link)
      .attr('role', 'tab')
      .attr('id', id)
      .attr('aria-selected', String(activo))
      .attr('aria-controls', `panel-${ti}-${i}`)
      .attr('tabindex', activo ? '0' : '-1')
      .removeAttr('data-w-tab')
      .removeAttr('href');
  });
  $t.find('.w-tab-pane').each((i, pane) => {
    $(pane)
      .attr('role', 'tabpanel')
      .attr('id', `panel-${ti}-${i}`)
      .attr('aria-labelledby', `tab-${ti}-${i}`)
      .removeAttr('data-w-tab');
  });
});

// --- Formulario de contacto: se sustituye por el componente propio ------
// El de Webflow depende de sus servidores y muere al cancelar el plan.
main.find('form[data-name="Contact 6 Form"]').closest('.w-form').each((_, bloque) => {
  $(bloque).replaceWith('<span data-componente="FormularioContacto"></span>');
});
// El mini formulario de email de la barra tampoco tiene backend: se convierte
// en un enlace directo a WhatsApp, que es el canal real de reservas.
main.find('form[data-name="Email Form"]').closest('.w-form').each((_, bloque) => {
  avisos.push('Mini formulario "Tus fechas" sustituido: era type=email con placeholder de fechas (no se podia enviar)');
  $(bloque).replaceWith('<span data-componente="VerificarFechas"></span>');
});

// --- Scripts de Webflow que dependian de jQuery -------------------------
// La pagina de habitaciones traia un <script src="code.jquery.com"> mas unas
// lineas de jQuery para atenuar las tarjetas al pasar el raton. Astro conserva
// ese import remoto, asi que la pagina seguia descargando 30 KB de jQuery de un
// tercero para un efecto de seis lineas. Se eliminan aqui y el mismo efecto se
// reimplementa en Base.astro con JavaScript nativo.
main.find('script').each((_, el) => {
  const src = $(el).attr('src') || '';
  const codigo = $(el).html() || '';
  if (/jquery/i.test(src) || /\$\(/.test(codigo)) {
    avisos.push(`Script jQuery de Webflow eliminado (reimplementado en Base.astro): ${src || 'en linea'}`);
    $(el).remove();
  }
});

// --- Enlaces vacios (#) que no llevan a ningun sitio --------------------
main.find('a[href="#"]').each((_, a) => {
  avisos.push(`Enlace a "#" sin destino: "${$(a).text().trim().slice(0, 40)}"`);
});

let html = $.html(main);

// Los marcadores vuelven a ser componentes.
html = html.replace(/<span data-componente="FormularioContacto"><\/span>/g, '<FormularioContacto />');
html = html.replace(/<span data-componente="VerificarFechas"><\/span>/g, '<VerificarFechas />');

// Los marcadores vuelven a ser componentes <Foto>.
html = html.replace(/<span data-foto="([^"]+)"><\/span>/g, (_, b64) =>
  `<Foto ${Buffer.from(b64, 'base64').toString('utf8')} />`
);

// Los <a> a WhatsApp abren fuera del sitio: rel de seguridad.
html = html.replace(/<a href="(https:\/\/wa\.me[^"]*)"/g, '<a href="$1" rel="noopener"');

// Astro exige cerrar las etiquetas vacias.
html = html.replace(/<(br|img|input|hr)([^>]*?)\/?>/g, '<$1$2 />');

console.log(html);
if (avisos.length) {
  console.error(`\n--- AVISOS (${pagina}) ---`);
  [...new Set(avisos)].forEach((a) => console.error('  ! ' + a));
}
