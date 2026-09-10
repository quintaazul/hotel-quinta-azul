/**
 * Manda www.hotelquintaazul.com a hotelquintaazul.com con un 301, conservando
 * la ruta y los parametros.
 *
 * Es un Worker aparte y no parte del sitio porque el sitio son archivos
 * estaticos: Cloudflare los entrega sin ejecutar el codigo del Worker, asi que
 * ahi no hay forma de mirar el hostname. Hacerlo en el Worker principal
 * obligaria a ejecutarlo en CADA visita (run_worker_first), y dejarian de ser
 * gratis e ilimitadas.
 *
 * En Webflow el www servia una copia vieja del sitio (10-jul) sin canonical:
 * un duplicado indexable. Con el 301 Google junta las dos en una.
 */
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = 'hotelquintaazul.com';
    url.port = '';
    return Response.redirect(url.href, 301);
  },
};
