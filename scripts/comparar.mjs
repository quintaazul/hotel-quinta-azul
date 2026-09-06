#!/usr/bin/env node
/**
 * Compara la version en Astro (dist/) contra el original de Webflow
 * (_baseline/) y reporta las diferencias que importan.
 *
 * No compara el HTML byte a byte, porque hay cambios previstos y deseados
 * (imagenes locales, sin jQuery, atributos ARIA). Compara lo que el usuario
 * percibe: textos, encabezados, enlaces, imagenes y estructura de secciones.
 *
 *   npm run comparar
 */
import { readFileSync, existsSync } from 'node:fs';
import * as cheerio from 'cheerio';

const PAGINAS = [
  ['home', 'dist/index.html'],
  ['hospedaje', 'dist/hospedaje.html'],
  ['celebraciones', 'dist/celebraciones.html'],
  ['ubicacion', 'dist/ubicacion.html'],
  ['contacto', 'dist/contacto.html'],
];

const limpia = (s) => (s || '').replace(/\s+/g, ' ').trim();
let totalDif = 0;
let totalOk = 0;

/** Cambios previstos y aprobados. Si aparece algo fuera de esta lista, es una regresion. */
const CAMBIOS_PREVISTOS = {
  imagenes: {
    'mesa de trabajo 12.png': 'logo-navbar-hotel-quinta-azul.webp',
    'mesa de trabajo 10.png': 'logo-quinta-azul-mesa-10.webp',
    'hotel en nuevo leon garcia, mexico.webp': 'hero-hotel-quinta-azul-garcia-nuevo-leon.webp',
  },
  // El logo del pie enlazaba a "#", que no lleva a ningun sitio. Ahora va al inicio.
  enlaces: ['(icono) -> #'],
  // Textos que estaban en el HTML de Webflow y ya no tienen sentido.
  // El bloque "Tus fechas" era un formulario roto (pedia fechas pero validaba
  // como correo) que ademas moria con el plan de Webflow. Ahora abre WhatsApp,
  // asi que sus mensajes de exito y error nunca se mostrarian.
  textosQuitados: [
    '¡Perfecto! Nos pondremos en contacto en los próximos minutos.',
    'No pudimos procesar tu solicitud. Intenta de nuevo.',
  ],
  // Texto anadido a proposito: el campo de fechas no tenia nombre accesible,
  // asi que se le puso una etiqueta que solo leen los lectores de pantalla.
  textosAnadidos: ['Tus fechas de estancia'],
};

const nombreImagen = (src) => {
  const f = decodeURIComponent((src || '').split('/').pop() || '');
  return f
    .replace(/^[0-9a-f]{24}_/, '')                 // prefijo del CDN de Webflow
    .replace(/\.[A-Za-z0-9_-]{8,}(_[A-Za-z0-9_-]+)?\.(webp|png|jpe?g)$/i, '.$2') // hash de Astro
    .replace(/-p-\d+(\.\w+)$/, '$1')               // variante responsive de Webflow
    .toLowerCase();
};

for (const [nombre, archivoDist] of PAGINAS) {
  if (!existsSync(archivoDist)) {
    console.log(`\n[${nombre}] dist no encontrado, ¿corriste npm run build?`);
    continue;
  }
  const w = cheerio.load(readFileSync(`_baseline/${nombre}.html`, 'utf8'));
  const a = cheerio.load(readFileSync(archivoDist, 'utf8'));
  const dif = [];

  // --- Encabezados: mismo orden, mismo nivel, mismo texto ---------------
  const enc = ($) => $('h1,h2,h3,h4,h5,h6').map((_, h) => `${h.tagName}|${limpia($(h).text())}`).get();
  const eW = enc(w), eA = enc(a);
  if (eW.length !== eA.length) dif.push(`encabezados: Webflow ${eW.length}, Astro ${eA.length}`);
  const sinEspacios = (t) => t.replace(/\s+/g, ' ');
  eW.forEach((t, i) => {
    if (eA[i] !== t) dif.push(`encabezado ${i}:\n        Webflow: ${t}\n        Astro:   ${eA[i] ?? '(falta)'}`);
  });

  // --- Texto visible ----------------------------------------------------
  const texto = ($) => {
    const $c = $.load($.html());
    $c('script,style,noscript').remove();
    return limpia($c('body').text());
  };
  // Se comparan las PALABRAS, no los espacios: Webflow deja saltos de linea
  // entre etiquetas que al extraer texto se vuelven espacios sueltos, y eso no
  // es una diferencia visible para nadie.
  // Se descuentan los textos cuyo cambio esta aprobado y documentado, en el
  // lado que corresponda, y luego se comparan las palabras sin espacios.
  const palabras = (t, lista) => {
    let s = t;
    for (const frase of lista) s = s.split(frase).join('');
    return s.replace(/\s+/g, '');
  };
  const tW = texto(w), tA = texto(a);
  if (palabras(tW, CAMBIOS_PREVISTOS.textosQuitados) !== palabras(tA, CAMBIOS_PREVISTOS.textosAnadidos)) {
    // Localizar la primera divergencia para poder señalarla
    let i = 0;
    while (i < Math.min(tW.length, tA.length) && tW[i] === tA[i]) i++;
    dif.push(
      `texto visible difiere en la posicion ${i} (Webflow ${tW.length} car., Astro ${tA.length})\n` +
      `        Webflow: ...${tW.slice(Math.max(0, i - 40), i + 60)}\n` +
      `        Astro:   ...${tA.slice(Math.max(0, i - 40), i + 60)}`
    );
  }

  // --- Enlaces ----------------------------------------------------------
  const enlaces = ($) =>
    $('a[href]').map((_, e) => `${limpia($(e).text()) || '(icono)'} -> ${$(e).attr('href')}`).get().sort();
  const lW = enlaces(w), lA = enlaces(a);
  const faltan = lW.filter((x) => !lA.includes(x) && !CAMBIOS_PREVISTOS.enlaces.includes(x));
  const sobran = lA.filter((x) => !lW.includes(x));
  faltan.forEach((x) => dif.push(`enlace que estaba y ya no: ${x}`));
  sobran.forEach((x) => dif.push(`enlace nuevo que no estaba: ${x}`));

  // --- Imagenes: mismo archivo y mismo orden ----------------------------
  const imgs = ($) => $('img').map((_, e) => nombreImagen($(e).attr('src'))).get();
  const iW = imgs(w), iA = imgs(a);
  if (iW.length !== iA.length) dif.push(`imagenes: Webflow ${iW.length}, Astro ${iA.length}`);
  iW.forEach((f, i) => {
    const esperado = CAMBIOS_PREVISTOS.imagenes[f] || f;
    if (iA[i] && iA[i] !== esperado) {
      dif.push(`imagen ${i}: se esperaba "${esperado}" (de Webflow "${f}") pero hay "${iA[i]}"`);
    }
  });

  // --- Estructura de secciones -----------------------------------------
  const secciones = ($) =>
    $('.main-wrapper').children().map((_, s) => `${s.tagName}.${(($(s).attr('class') || '').split(' ')[0])}`).get();
  const sW = secciones(w), sA = secciones(a);
  if (sW.join() !== sA.join()) dif.push(`secciones:\n        Webflow: ${sW.join(' ')}\n        Astro:   ${sA.join(' ')}`);

  // --- Metadatos --------------------------------------------------------
  const metaDe = ($) => {
    let d;
    $('meta').each((_, m) => { if (($(m).attr('name') || $(m).attr('property')) === 'description') d = $(m).attr('content'); });
    return { title: limpia($('title').text()), desc: limpia(d) };
  };
  const mW = metaDe(w), mA = metaDe(a);
  if (mW.title !== mA.title) dif.push(`title:\n        Webflow: ${mW.title}\n        Astro:   ${mA.title}`);
  if (mW.desc !== mA.desc) dif.push(`meta description difiere`);

  if (dif.length) {
    totalDif += dif.length;
    console.log(`\n${'─'.repeat(70)}\n[${nombre}]  ${dif.length} diferencia(s)\n${'─'.repeat(70)}`);
    dif.forEach((d) => console.log('  • ' + d));
  } else {
    totalOk++;
    console.log(`\n[${nombre}]  sin diferencias: encabezados, texto, enlaces, imagenes, secciones y metadatos coinciden`);
  }
}

console.log(`\n${'═'.repeat(70)}`);
console.log(`Paginas identicas: ${totalOk}/${PAGINAS.length}   Diferencias totales: ${totalDif}`);
console.log('═'.repeat(70));
process.exit(totalDif ? 1 : 0);
