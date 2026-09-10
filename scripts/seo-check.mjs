#!/usr/bin/env node
/**
 * Verificacion de SEO tecnico sobre dist/. Corre despues de `astro build`
 * y sale con codigo 1 si algo falla, para que el deploy no ocurra.
 *
 * Cada regla existe porque el defecto correspondiente esta HOY en produccion
 * en Webflow. El numero entre corchetes es el de la auditoria del 19-ago-2026.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const errores = [];
const avisos = [];

async function paginas(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await paginas(full)));
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const uno = (html, re) => (html.match(re) || [])[1]?.trim();
const todos = (html, re) => [...html.matchAll(re)];

/** Lee un atributo sin asumir el orden dentro de la etiqueta.
 *  Webflow emite content="..." ANTES de name="...", asi que un regex
 *  con el orden fijo daba un falso positivo de "sin meta description". */
const attr = (tag, nombre) =>
  new RegExp(`\\s${nombre}=("([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(2).find((v) => v !== undefined);

/** Busca el content de un <meta> por su name o property, en cualquier orden. */
function meta(html, clave) {
  for (const [tag] of todos(html, /<meta\b[^>]*>/gi)) {
    if (attr(tag, 'name') === clave || attr(tag, 'property') === clave) return attr(tag, 'content')?.trim();
  }
  return undefined;
}

/** Busca el href de un <link> por su rel, en cualquier orden. */
function link(html, rel) {
  for (const [tag] of todos(html, /<link\b[^>]*>/gi)) {
    if (attr(tag, 'rel') === rel) return attr(tag, 'href')?.trim();
  }
  return undefined;
}

for (const archivo of await paginas(DIST)) {
  const ruta = '/' + relative(DIST, archivo).split(sep).join('/').replace(/(index)?\.html$/, '');
  const html = await readFile(archivo, 'utf8');
  // Para contar imagenes y encabezados hay que mirar SOLO el marcado que se
  // renderiza. Sin esto, una plantilla HTML escrita dentro de un <script>
  // (por ejemplo la del visor de fotos) se contaba como una imagen real.
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const err = (m) => errores.push(`${ruta.padEnd(18)} ${m}`);
  const avi = (m) => avisos.push(`${ruta.padEnd(18)} ${m}`);

  // [5] Ninguna de las 10 paginas en Webflow declara idioma.
  const lang = uno(html, /<html[^>]*\slang="([^"]*)"/);
  if (!lang) err('sin atributo lang en <html>');

  // [-] title obligatorio y con longitud util.
  const title = uno(html, /<title[^>]*>([\s\S]*?)<\/title>/);
  if (!title) err('sin <title>');
  else if (title.length > 62) avi(`title de ${title.length} caracteres (se trunca en el SERP)`);

  // [-] meta description obligatoria.
  const desc = meta(html, 'description');
  if (!desc) err('sin meta description');
  else if (desc.length > 165) avi(`meta description de ${desc.length} caracteres`);

  // [-] Open Graph: sin esto el enlace compartido por WhatsApp sale sin tarjeta,
  //     y WhatsApp es el canal de conversion principal (76 enlaces wa.me por sitio).
  for (const og of ['og:title', 'og:description', 'og:image']) {
    if (!meta(html, og)) err(`sin ${og}`);
  }

  // No basta con que la etiqueta exista: la imagen tiene que CARGAR.
  // La primera version solo comprobaba la etiqueta, y las dos og:image
  // apuntaban a un archivo inexistente. Un enlace compartido salia roto y,
  // como el schema Hotel reutiliza esa misma URL, el schema tambien.
  const ogImg = meta(html, 'og:image');
  if (ogImg) {
    const ruta = ogImg.replace(/^https?:\/\/[^/]+/, '');
    if (ruta.startsWith('/') && !existsSync(join(DIST, ruta))) {
      err(`og:image apunta a un archivo que no existe: ${ruta}`);
    }
  }

  // [3][4] QA tenia canonical solo en la home; LA apuntaba al apex que redirige.
  const canon = link(html, 'canonical');
  if (!canon) err('sin canonical');
  else if (!canon.startsWith('https://hotelquintaazul.com')) err(`canonical fuera del apex: ${canon}`);
  else if (canon.startsWith('https://www.')) err(`canonical apuntando a www: ${canon}`);

  // [11] En Webflow tres imagenes de la home salieron con alt="" — incluidos
  // los dos logos. Ojo: el defecto real es alt VACIO, no alt ausente, asi que
  // comprobar solo la presencia del atributo no habria detectado nada.
  // Para una imagen decorativa de verdad, marcarla con data-decorativa.
  for (const [tag] of todos(visible, /<img\b[^>]*>/g)) {
    const corto = tag.replace(/\s+/g, ' ').slice(0, 95);
    const alt = /\salt="([^"]*)"/.exec(tag);
    if (!alt) err(`imagen sin atributo alt: ${corto}`);
    else if (!alt[1].trim() && !/\sdata-decorativa\b/.test(tag)) {
      err(`imagen con alt vacio: ${corto}`);
    }
  }

  // [-] Jerarquia de encabezados: un solo h1 y sin saltar niveles.
  const niveles = todos(html, /<h([1-6])\b/g).map((m) => Number(m[1]));
  const h1 = niveles.filter((n) => n === 1).length;
  if (h1 === 0) err('sin h1');
  if (h1 > 1) err(`${h1} elementos h1 (debe haber uno)`);
  for (let i = 1; i < niveles.length; i++) {
    if (niveles[i] - niveles[i - 1] > 1) {
      err(`salto de encabezado h${niveles[i - 1]} a h${niveles[i]}`);
      break;
    }
  }

  // [8] El schema de QA citaba una imagen inexistente. Al menos debe parsear.
  for (const [, json] of todos(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(json); } catch { err('JSON-LD invalido'); }
  }

  // [10] jQuery cargado dos veces en las paginas de habitaciones.
  const jq = todos(html, /<script[^>]+src="[^"]*jquery[^"]*"/gi).length;
  if (jq) err(`carga jQuery (${jq}) — el port no debe necesitarlo`);
}

// --- Comprobaciones de sitio, no de pagina -----------------------------
// robots.txt y el sitemap se comprueban una sola vez. En Webflow, el robots
// de Quinta Azul existia pero estaba VACIO y su sitemap.xml daba 404.
if (!existsSync(join(DIST, 'robots.txt'))) {
  errores.push('sitio               falta robots.txt');
} else {
  const robots = await readFile(join(DIST, 'robots.txt'), 'utf8');
  if (!/^\s*Sitemap:\s*https?:\/\//im.test(robots)) {
    errores.push('sitio               robots.txt no declara el Sitemap');
  }
}
if (!existsSync(join(DIST, 'sitemap-index.xml'))) {
  errores.push('sitio               falta sitemap-index.xml');
}

const linea = '─'.repeat(64);
if (avisos.length) {
  console.log(`\n${linea}\nAvisos (no bloquean)\n${linea}`);
  avisos.forEach((a) => console.log('  ~ ' + a));
}
if (errores.length) {
  console.error(`\n${linea}\nSEO: ${errores.length} error(es). Build detenido.\n${linea}`);
  errores.forEach((e) => console.error('  ✗ ' + e));
  console.error('');
  process.exit(1);
}
console.log(`\n✓ SEO: todas las paginas pasan (lang, title, description, canonical, alt, headings, JSON-LD).\n`);
