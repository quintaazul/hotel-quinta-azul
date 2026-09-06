#!/usr/bin/env node
/**
 * Comprueba que ningun recurso ni enlace interno del sitio este roto.
 * Necesita el servidor local levantado (npm run preview).
 *
 *   npm run enlaces
 */
import { readFileSync, readdirSync } from 'node:fs';
import * as cheerio from 'cheerio';

const BASE = process.env.BASE || 'http://localhost:4321';
const urls = new Set();
const externos = new Set();

for (const archivo of readdirSync('dist').filter((f) => f.endsWith('.html'))) {
  const $ = cheerio.load(readFileSync(`dist/${archivo}`, 'utf8'));
  $('img[src], script[src]').each((_, e) => urls.add($(e).attr('src')));
  $('img[srcset]').each((_, e) =>
    ($(e).attr('srcset') || '').split(',').forEach((s) => urls.add(s.trim().split(/\s+/)[0]))
  );
  $('link[href]').each((_, e) => urls.add($(e).attr('href')));
  $('a[href]').each((_, e) => {
    const h = $(e).attr('href');
    if (!h) return;
    if (h.startsWith('/')) urls.add(h);
    else if (/^https?:/.test(h)) externos.add(h);
  });
}

const internos = [...urls].filter((u) => u && u.startsWith('/'));
console.log(`Comprobando ${internos.length} recursos y rutas internas en ${BASE} ...\n`);

let rotos = 0;
for (const u of internos) {
  const r = await fetch(BASE + u, { redirect: 'manual' }).catch(() => null);
  const code = r ? r.status : 'sin respuesta';
  if (code !== 200) {
    console.log(`  ${String(code).padEnd(14)} ${u}`);
    rotos++;
  }
}
console.log(rotos ? `\n  ${rotos} recurso(s) roto(s)` : '  Todos responden 200.');

console.log(`\nEnlaces externos (${externos.size}) — no se comprueban, solo se listan:`);
[...externos].sort().forEach((e) => console.log('   ' + e.slice(0, 100)));

process.exit(rotos ? 1 : 0);
