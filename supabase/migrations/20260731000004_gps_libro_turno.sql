-- GPS Fase 1: coordenadas capturadas en los 3 momentos del libro de guardia.
-- apertura_*: al abrir el turno. cierre_*: al cerrarlo. relevo_*: al firmar
-- el relevo (evento propio, distinto de cierre — lo firma el técnico entrante).
-- *_gps_capturado_at es distinto de created_at/horario_*: el fix de GPS se
-- pide en background al abrir la pantalla, no al momento del submit.
ALTER TABLE public.libro_turno
  ADD COLUMN IF NOT EXISTS apertura_latitud          DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS apertura_longitud         DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS apertura_precision_m      DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS apertura_gps_capturado_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS cierre_latitud            DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS cierre_longitud           DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS cierre_precision_m        DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS cierre_gps_capturado_at   TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS relevo_latitud            DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS relevo_longitud           DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS relevo_precision_m        DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS relevo_gps_capturado_at   TIMESTAMPTZ;

-- ROLLBACK:
-- ALTER TABLE public.libro_turno
--   DROP COLUMN IF EXISTS apertura_latitud,
--   DROP COLUMN IF EXISTS apertura_longitud,
--   DROP COLUMN IF EXISTS apertura_precision_m,
--   DROP COLUMN IF EXISTS apertura_gps_capturado_at,
--   DROP COLUMN IF EXISTS cierre_latitud,
--   DROP COLUMN IF EXISTS cierre_longitud,
--   DROP COLUMN IF EXISTS cierre_precision_m,
--   DROP COLUMN IF EXISTS cierre_gps_capturado_at,
--   DROP COLUMN IF EXISTS relevo_latitud,
--   DROP COLUMN IF EXISTS relevo_longitud,
--   DROP COLUMN IF EXISTS relevo_precision_m,
--   DROP COLUMN IF EXISTS relevo_gps_capturado_at;
