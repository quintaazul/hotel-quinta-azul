#!/usr/bin/env node
/**
 * Ensambla las paginas .astro: toma el <main> convertido y lo envuelve en el
 * layout, con el title y la description REALES de la pagina de Webflow —
 * no inventados — para no perder nada de SEO en la migracion.
 *
 *   node scripts/generar-paginas.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as cheerio from 'cheerio';

const PAGINAS = [
  { base: 'home', archivo: 'src/pages/index.astro', css: 'page.home.css' },
  { base: 'hospedaje', archivo: 'src/pages/hospedaje.astro', css: 'page.hospedaje.css' },
  { base: 'celebraciones', archivo: 'src/pages/celebraciones.astro', css: 'page.celebraciones.css' },
  { base: 'ubicacion', archivo: 'src/pages/ubicacion.astro', css: 'page.ubicacion.css' },
  { base: 'contacto', archivo: 'src/pages/contacto.astro', css: 'page.contacto.css' },
];

/** Lee un atributo sin asumir el orden (Webflow emite content= antes de name=). */
const meta = ($, clave) => {
  let v;
  $('meta').each((_, m) => {
    const n = $(m).attr('name') || $(m).attr('property');
    if (n === clave) v = $(m).attr('content');
  });
  return v;
};

for (const p of PAGINAS) {
  const $ = cheerio.load(readFileSync(`_baseline/${p.base}.html`, 'utf8'));
  const title = $('title').text().trim();
  const description = (meta($, 'description') || '').trim();
  if (!title || !description) throw new Error(`${p.base}: falta title o description en el original`);

  const main = execFileSync('node', ['scripts/convertir.mjs', p.base], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  // El schema propio de la pagina (p. ej. las FAQ de contacto) se conserva.
  let schemaExtra = 'null';
  $('script[type="application/ld+json"]').each((_, s) => {
    const d = JSON.parse($(s).html());
    if (d['@type'] && d['@type'] !== 'Hotel') {
      schemaExtra = JSON.stringify(d, null, 2).replace(/\n/g, '\n');
    }
  });

  // Solo se importa lo que la pagina usa de verdad.
  const componentes = [
    ['Foto', '<Foto '],
    ['FormularioContacto', '<FormularioContacto />'],
    ['VerificarFechas', '<VerificarFechas />'],
  ]
    .filter(([, marca]) => main.includes(marca))
    .map(([nombre]) => `\nimport ${nombre} from '../components/${nombre}.astro';`)
    .join('');
  const contenido = `---
// Generado por scripts/generar-paginas.mjs a partir de _baseline/${p.base}.html
// El marcado y las clases son los de Webflow. Para regenerar: npm run generar
import Base from '../layouts/Base.astro';
import Navbar from '../components/Navbar.astro';
import Footer from '../components/Footer.astro';${componentes}
import '../styles/${p.css}';

const schemaPagina = ${schemaExtra};
---
<Base
  title=${JSON.stringify(title)}
  description=${JSON.stringify(description)}
  schema={schemaPagina}
>
  <div class="page-wrapper">
    <Navbar />
${main
  .split('\n')
  .map((l) => '    ' + l)
  .join('\n')}
    <Footer />
  </div>
</Base>
`;

  writeFileSync(p.archivo, contenido, 'utf8');
  console.log(
    `  ${p.archivo.padEnd(34)} title=${title.length}c  desc=${description.length}c  schema=${schemaExtra === 'null' ? 'solo Hotel' : 'Hotel + pagina'}`
  );
}
console.log('\nListo. Revisa el resultado con: npm run build');
