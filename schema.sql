-- Solicitudes de reserva que llegan por el formulario de contacto.
--
-- Existe para que ningun lead dependa de que un correo llegue: si el correo
-- falla, rebota o cae en spam, la solicitud sigue guardada aqui.
--
-- Aplicar:  npx wrangler d1 execute quinta-azul-solicitudes --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS solicitudes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recibida_en TEXT    NOT NULL,              -- ISO 8601 en UTC
  nombre      TEXT    NOT NULL,
  contacto    TEXT    NOT NULL,              -- telefono o correo, como lo escribio la persona
  fechas      TEXT    NOT NULL,              -- texto libre: "5 al 6 de septiembre"
  personas    INTEGER,
  habitacion  TEXT,                          -- sencilla | doble
  motivo      TEXT,                          -- hospedaje | celebracion | negocios | ...
  mensaje     TEXT,
  correo_ok   INTEGER NOT NULL DEFAULT 0,    -- 1 si el aviso por correo salio bien
  correo_error TEXT,                         -- por que fallo, si fallo
  ip_pais     TEXT,                          -- pais segun Cloudflare, para detectar abuso
  user_agent  TEXT
);

-- Las consultas normales son "las mas recientes primero".
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON solicitudes (recibida_en DESC);

-- Para revisar rapido cuales no se avisaron por correo.
CREATE INDEX IF NOT EXISTS idx_solicitudes_correo ON solicitudes (correo_ok, recibida_en DESC);
