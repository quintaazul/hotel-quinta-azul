#!/usr/bin/env node
/**
 * Imprime el esqueleto de una pagina: secciones, clases, encabezados, textos,
 * imagenes y enlaces. Es la herramienta de lectura del original de Webflow
 * para poder portarlo fiel.
 *
 *   node scripts/outline.mjs _baseline/home.html            # estructura
 *   node scripts/outline.mjs _baseline/home.html --texto    # + todos los textos
 */
import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';

const [archivo, ...flags] = process.argv.slice(2);
const verTexto = flags.includes('--texto');
const $ = cheerio.load(readFileSync(archivo, 'utf8'));

const limpia = (s) => (s || '').replace(/\s+/g, ' ').trim();
const cls = (el) => {
  const c = limpia($(el).attr('class'));
  return c ? '.' + c.split(' ').join('.') : '';
};

// Secciones de primer nivel dentro del wrapper de la pagina
const raiz = $('.page-wrapper').length ? $('.page-wrapper').children() : $('body').children();

console.log(`\n${'='.repeat(78)}\n${archivo}\n${'='.repeat(78)}`);
raiz.each((i, sec) => {
  const tag = sec.tagName;
  console.log(`\n[${String(i).padStart(2, '0')}] <${tag}>${cls(sec)}`);

  // Encabezados de la seccion
  $(sec).find('h1,h2,h3,h4,h5,h6').each((_, h) => {
    const t = limpia($(h).text());
    if (t) console.log(`     ${h.tagName.toUpperCase()}  ${t.slice(0, 88)}`);
  });

  // Imagenes
  $(sec).find('img').each((_, im) => {
    const src = decodeURIComponent(($(im).attr('src') || '').split('/').pop() || '');
    const alt = $(im).attr('alt');
    const marca = alt === undefined ? 'SIN-ALT' : !alt.trim() ? 'ALT-VACIO' : 'ok';
    console.log(`     IMG [${marca}] ${src.replace(/^[0-9a-f]{24}_/, '').slice(0, 62)}${cls(im)}`);
  });

  // Enlaces y botones
  const enlaces = new Map();
  $(sec).find('a').each((_, a) => {
    const t = limpia($(a).text()) || '(sin texto)';
    const h = $(a).attr('href') || '';
    enlaces.set(`${t} -> ${h.replace(/^https:\/\/wa\.me\/\d+.*/, 'wa.me')}`, true);
  });
  [...enlaces.keys()].slice(0, 12).forEach((e) => console.log(`     A    ${e.slice(0, 88)}`));

  // Componentes interactivos de Webflow presentes
  const comps = [];
  for (const [sel, nombre] of [
    ['.w-tabs', 'TABS'], ['.w-slider', 'SLIDER'], ['.w-dropdown', 'DROPDOWN'],
    ['.w-nav', 'NAV'], ['.w-lightbox', 'LIGHTBOX'], ['form', 'FORM'],
    ['[data-w-id]', 'ANIMACION-IX2'],
  ]) {
    const n = $(sec).find(sel).length + ($(sec).is(sel) ? 1 : 0);
    if (n) comps.push(`${nombre}x${n}`);
  }
  if (comps.length) console.log(`     >>>> ${comps.join('  ')}`);

  if (verTexto) {
    $(sec).find('p, .text-size-medium, .text-style-tagline, blockquote').each((_, p) => {
      const t = limpia($(p).text());
      if (t && t.length > 3) console.log(`     P    ${t.slice(0, 150)}`);
    });
  }
});
console.log('');
