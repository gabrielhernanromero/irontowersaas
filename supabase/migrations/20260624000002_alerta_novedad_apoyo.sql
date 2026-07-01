-- Agrega el tipo 'novedad_apoyo' al constraint de alertas.
-- Se usa para notificar al encargado cuando el apoyo registra una novedad.

ALTER TABLE alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
ALTER TABLE alertas
  ADD CONSTRAINT alertas_tipo_check CHECK (
    tipo = ANY(ARRAY[
      'novedad_planilla',
      'planilla_pendiente',
      'certificacion_vence',
      'ronda_proxima',
      'ronda_vencida',
      'ausencia_encargado',
      'ronda_asignada',
      'novedad_apoyo'
    ]::text[])
  );
