-- Columna para registrar motivo cuando el encargado cierra antes del horario programado
ALTER TABLE public.libro_turno
  ADD COLUMN IF NOT EXISTS motivo_cierre_anticipado text;

-- Agregar tipo cierre_anticipado al CHECK constraint de alertas
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check CHECK (
  tipo = ANY(ARRAY[
    'novedad_planilla',
    'planilla_pendiente',
    'certificacion_vence',
    'ronda_proxima',
    'ronda_vencida',
    'ausencia_encargado',
    'ronda_asignada',
    'novedad_apoyo',
    'cierre_anticipado'
  ]::text[])
);
