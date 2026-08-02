-- GPS Fase 1: nuevo tipo de alerta para desvíos de geocerca (>1km entre la
-- coordenada capturada y la sede del cliente, o entre cierre y relevo del
-- mismo turno). Sigue el patrón de reescritura completa del CHECK ya usado
-- en las migraciones anteriores de alertas.tipo.
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check CHECK (
  tipo = ANY (ARRAY[
    'novedad_planilla',
    'planilla_pendiente',
    'certificacion_vence',
    'ronda_proxima',
    'ronda_vencida',
    'ausencia_encargado',
    'ronda_asignada',
    'novedad_apoyo',
    'cierre_anticipado',
    'turno_sin_cerrar',
    'novedad_scan',
    'excepcion_gps'
  ])
);

-- ROLLBACK:
-- ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
-- ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check CHECK (
--   tipo = ANY (ARRAY[
--     'novedad_planilla','planilla_pendiente','certificacion_vence','ronda_proxima',
--     'ronda_vencida','ausencia_encargado','ronda_asignada','novedad_apoyo',
--     'cierre_anticipado','turno_sin_cerrar','novedad_scan'
--   ])
-- );
