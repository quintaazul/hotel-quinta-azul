/**
 * Worker del sitio. Hace dos cosas:
 *
 *   1. POST /api/contacto  ->  recibe una solicitud de reserva
 *   2. cualquier otra ruta ->  entrega el sitio estatico
 *
 * Regla que manda sobre todas las demas: **una solicitud valida NUNCA se
 * pierde**. Primero se guarda en la base de datos y despues se intenta el
 * correo. Si el correo falla, la solicitud ya esta a salvo y el fallo queda
 * registrado para poder recuperarla.
 */

import { EmailMessage } from 'cloudflare:email';
import { createMimeMessage, Mailbox } from 'mimetext';

/** Lo que puede llegar del formulario, antes de validar. */
interface CamposCrudos {
  nombre?: string;
  contacto?: string;
  fechas?: string;
  personas?: string;
  habitacion?: string;
  motivo?: string;
  mensaje?: string;
  privacidad?: string;
}

/** Limites de tamano. Evitan que alguien mande un cuerpo enorme. */
const LIMITES = {
  cuerpo: 32 * 1024, // 32 KB de formulario es de sobra
  nombre: 120,
  contacto: 160,
  fechas: 120,
  mensaje: 5000,
  token: 2048,
  personasMax: 200,
} as const;

const HABITACIONES = new Set(['sencilla', 'doble']);
const MOTIVOS = new Set(['hospedaje', 'celebracion', 'negocios', 'otro-motivo', 'consulta', 'otro']);

const registrar = (nivel: 'info' | 'error', evento: string, datos: Record<string, unknown> = {}) => {
  // JSON estructurado: se puede filtrar en los registros de Cloudflare.
  console[nivel === 'error' ? 'error' : 'log'](JSON.stringify({ nivel, evento, ...datos }));
};

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Claves de prueba publicadas por Cloudflare para desarrollo. Solo sirven en
 * local: no ejecutan el desafio de verdad.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const SECRETOS_DE_PRUEBA = new Set([
  '1x0000000000000000000000000000000AA', // siempre aprueba
  '2x0000000000000000000000000000000AA', // siempre bloquea
  '3x0000000000000000000000000000000AA', // token ya usado
]);
const esClaveDePrueba = (secreto: string | undefined) => !!secreto && SECRETOS_DE_PRUEBA.has(secreto);

/** Comprobacion conservadora: sin espacios, un solo @, y dominio con punto. */
const esCorreoValido = (v: string) => /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[A-Za-z]{2,}$/.test(v) && v.length <= 254;

/**
 * Comprueba el token de Turnstile contra Cloudflare. Falla cerrado: ante
 * cualquier duda (red caida, respuesta rara, accion que no cuadra), rechaza.
 */
async function verificarTurnstile(
  token: string,
  ip: string | null,
  env: Env
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!token || token.length > LIMITES.token) return { ok: false, motivo: 'token-ausente-o-enorme' };
  if (!env.TURNSTILE_SECRET) return { ok: false, motivo: 'falta-el-secreto-en-el-servidor' };

  const permitidos = new Set(
    (env.TURNSTILE_HOSTNAMES ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
  );
  if (permitidos.size === 0) return { ok: false, motivo: 'sin-hostnames-permitidos' };

  let resultado: { success?: boolean; action?: string; hostname?: string; 'error-codes'?: string[] };
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    if (!r.ok) throw new Error(`siteverify respondio ${r.status}`);
    resultado = await r.json();
  } catch (e) {
    registrar('error', 'turnstile_inalcanzable', { detalle: String(e) });
    return { ok: false, motivo: 'no-se-pudo-verificar' };
  }

  if (!resultado.success) return { ok: false, motivo: (resultado['error-codes'] ?? []).join(',') || 'rechazado' };

  // Las claves de PRUEBA de Cloudflare no ejecutan el desafio real: devuelven
  // success sin `action` ni `hostname`, asi que las dos comprobaciones de abajo
  // nunca podrian pasar en desarrollo.
  //
  // Relajarlas se ata a que el secreto sea una clave de prueba conocida, no a
  // una variable de entorno. Asi es imposible debilitar produccion por error de
  // configuracion: con el secreto real, las tres comprobaciones se aplican
  // siempre. Y si alguien dejara una clave de prueba en produccion, queda el
  // aviso en los registros.
  if (esClaveDePrueba(env.TURNSTILE_SECRET)) {
    registrar('error', 'turnstile_en_modo_prueba', {
      aviso: 'Se esta usando una clave de prueba: el formulario NO esta protegido.',
    });
    return { ok: true };
  }

  if (resultado.action !== 'contacto') return { ok: false, motivo: `accion-inesperada:${resultado.action}` };
  if (!resultado.hostname || !permitidos.has(resultado.hostname)) {
    return { ok: false, motivo: `hostname-no-permitido:${resultado.hostname}` };
  }
  return { ok: true };
}

/** Arma y envia el aviso al hotel. Devuelve el error en vez de lanzarlo. */
async function avisarPorCorreo(d: Record<string, string>, env: Env): Promise<string | null> {
  try {
    const m = createMimeMessage();
    m.setSender({ addr: env.CORREO_ORIGEN, name: 'Hotel Quinta Azul' });
    m.setRecipient(env.CORREO_DESTINO);
    m.setSubject(`Nueva solicitud de reserva: ${d.nombre}`);

    // Si la persona dejo un correo, se pone como Reply-To: asi el hotel
    // responde desde Gmail y le llega directo a ella.
    //
    // El campo es texto libre ("8180990881", "juan @ gmail", ...), asi que hay
    // que comprobarlo de verdad: pasarle a mimetext algo que no sea una
    // direccion valida lanza MIMETEXT_INVALID_HEADER_VALUE y tumba el aviso
    // entero. Preferimos un correo sin Reply-To a un correo que no sale.
    if (esCorreoValido(d.contacto)) {
      // Tiene que ser un Mailbox: con una cadena o un objeto simple, mimetext
      // lanza MIMETEXT_INVALID_HEADER_VALUE y el aviso no sale.
      m.setHeader('Reply-To', new Mailbox({ addr: d.contacto }));
    }

    const lineas = [
      `Nombre:             ${d.nombre}`,
      `Teléfono o correo:  ${d.contacto}`,
      `Fechas:             ${d.fechas}`,
      `Personas:           ${d.personas || 'no indicado'}`,
      `Tipo de habitación: ${d.habitacion || 'no indicado'}`,
      `Motivo:             ${d.motivo || 'no indicado'}`,
      '',
      'Mensaje:',
      d.mensaje || '(sin mensaje)',
      '',
      '—',
      `Enviado desde el formulario de hotelquintaazul.com el ${d.recibida_en}`,
    ].join('\n');

    m.addMessage({ contentType: 'text/plain', data: lineas });

    await env.CORREO.send(new EmailMessage(env.CORREO_ORIGEN, env.CORREO_DESTINO, m.asRaw()));
    return null;
  } catch (e) {
    return String(e).slice(0, 500);
  }
}

async function recibirSolicitud(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const largo = Number(request.headers.get('content-length') ?? '0');
  if (largo > LIMITES.cuerpo) return json({ ok: false, error: 'La solicitud es demasiado grande.' }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'No pudimos leer el formulario.' }, 400);
  }

  const crudo = Object.fromEntries(form) as CamposCrudos;
  const ip = request.headers.get('cf-connecting-ip');

  // 1. Antes que nada, comprobar que no es un robot.
  const verificacion = await verificarTurnstile(String(form.get('cf-turnstile-response') ?? ''), ip, env);
  if (!verificacion.ok) {
    registrar('info', 'solicitud_rechazada', { motivo: verificacion.motivo, ip_pais: request.cf?.country });
    return json({ ok: false, error: 'No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo.' }, 403);
  }

  // 2. Validar y normalizar. Los campos obligatorios son los que el
  //    formulario ya marcaba como obligatorios en Webflow.
  const nombre = texto(crudo.nombre, LIMITES.nombre);
  const contacto = texto(crudo.contacto, LIMITES.contacto);
  const fechas = texto(crudo.fechas, LIMITES.fechas);
  const mensaje = texto(crudo.mensaje, LIMITES.mensaje);

  const faltan: string[] = [];
  if (!nombre) faltan.push('nombre');
  if (!contacto) faltan.push('teléfono o correo');
  if (!fechas) faltan.push('fechas');
  if (!mensaje) faltan.push('mensaje');
  if (crudo.privacidad !== 'si') faltan.push('aviso de privacidad');
  if (faltan.length) {
    return json({ ok: false, error: `Falta completar: ${faltan.join(', ')}.` }, 400);
  }

  const nPersonas = Number.parseInt(texto(crudo.personas, 8), 10);
  const personas = Number.isFinite(nPersonas) && nPersonas > 0 && nPersonas <= LIMITES.personasMax ? nPersonas : null;

  const habitacion = HABITACIONES.has(String(crudo.habitacion)) ? String(crudo.habitacion) : '';
  const motivo = MOTIVOS.has(String(crudo.motivo)) ? String(crudo.motivo) : '';
  const recibida_en = new Date().toISOString();

  // 3. Guardar PRIMERO. Si esto falla, se avisa a la persona: es preferible
  //    que reintente a que crea que reservo y nadie tenga su solicitud.
  let id: number | null = null;
  try {
    const r = await env.DB.prepare(
      `INSERT INTO solicitudes
         (recibida_en, nombre, contacto, fechas, personas, habitacion, motivo, mensaje, ip_pais, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
      .bind(
        recibida_en,
        nombre,
        contacto,
        fechas,
        personas,
        habitacion,
        motivo,
        mensaje,
        (request.cf?.country as string) ?? null,
        (request.headers.get('user-agent') ?? '').slice(0, 300)
      )
      .first<{ id: number }>();
    id = r?.id ?? null;
    registrar('info', 'solicitud_guardada', { id, ip_pais: request.cf?.country });
  } catch (e) {
    registrar('error', 'fallo_al_guardar', { detalle: String(e) });
    return json({ ok: false, error: 'Hubo un error al enviar. Intenta de nuevo o escríbenos por WhatsApp.' }, 500);
  }

  // 4. El correo va despues y NO bloquea la respuesta: la solicitud ya esta
  //    guardada, asi que la persona puede seguir con su vida.
  ctx.waitUntil(
    (async () => {
      const error = await avisarPorCorreo(
        { nombre, contacto, fechas, personas: String(personas ?? ''), habitacion, motivo, mensaje, recibida_en },
        env
      );
      try {
        await env.DB.prepare('UPDATE solicitudes SET correo_ok = ?, correo_error = ? WHERE id = ?')
          .bind(error ? 0 : 1, error, id)
          .run();
      } catch (e) {
        registrar('error', 'fallo_al_marcar_correo', { id, detalle: String(e) });
      }
      registrar(error ? 'error' : 'info', error ? 'correo_fallido' : 'correo_enviado', { id, detalle: error });
    })()
  );

  return json({ ok: true, mensaje: '¡Gracias! Nos pondremos en contacto pronto.' });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/contacto') {
      if (request.method !== 'POST') {
        return json({ ok: false, error: "Método no permitido." }, 405);
      }
      return recibirSolicitud(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
