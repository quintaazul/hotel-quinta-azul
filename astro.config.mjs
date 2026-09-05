import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// El apex es la URL canonica. Hoy www sirve un duplicado sin canonical
// (defecto 1 de la auditoria); Cloudflare lo redirigira al apex en el cutover.
export default defineConfig({
  site: 'https://hotelquintaazul.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap()],
});
