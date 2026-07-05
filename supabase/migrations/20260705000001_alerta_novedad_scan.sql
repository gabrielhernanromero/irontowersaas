-- Agregar tipo 'novedad_scan' a alertas para novedades reportadas en puntos de control
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
    'novedad_scan'
  ])
);

-- ROLLBACK:
-- ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
-- ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check CHECK (
--   tipo = ANY (ARRAY[
--     'novedad_planilla','planilla_pendiente','certificacion_vence',
--     'ronda_proxima','ronda_vencida','ausencia_encargado','ronda_asignada',
--     'novedad_apoyo','cierre_anticipado','turno_sin_cerrar'
--   ])
-- );
