-- Informe de Confiabilidad: reporte agregado mensual enviado automáticamente
-- al contacto del cliente (no un supervisor editando texto a mano, por eso
-- es un tipo distinto de 'ejecutivo'). supervisor_id queda NULL en estos
-- registros porque los genera el cron, no una persona.

ALTER TABLE public.informes DROP CONSTRAINT IF EXISTS informes_tipo_check;
ALTER TABLE public.informes ADD CONSTRAINT informes_tipo_check
  CHECK (tipo IN ('turno','incidencia','ejecutivo','vida_incidencia','confiabilidad'));

-- 'error' traza fallos del envío automático sin cortar el resto de la corrida
-- del cron (Regla de trazabilidad: quién/cuándo/a quién, incluyendo el caso
-- de error).
ALTER TABLE public.informes DROP CONSTRAINT IF EXISTS informes_estado_check;
ALTER TABLE public.informes ADD CONSTRAINT informes_estado_check
  CHECK (estado IN ('borrador','generando','listo','enviado','error'));

ALTER TABLE public.informes ADD COLUMN IF NOT EXISTS error_mensaje TEXT;

-- ROLLBACK
-- ALTER TABLE public.informes DROP COLUMN IF EXISTS error_mensaje;
-- ALTER TABLE public.informes DROP CONSTRAINT IF EXISTS informes_estado_check;
-- ALTER TABLE public.informes ADD CONSTRAINT informes_estado_check
--   CHECK (estado IN ('borrador','generando','listo','enviado'));
-- ALTER TABLE public.informes DROP CONSTRAINT IF EXISTS informes_tipo_check;
-- ALTER TABLE public.informes ADD CONSTRAINT informes_tipo_check
--   CHECK (tipo IN ('turno','incidencia','ejecutivo','vida_incidencia'));
