-- ──────────────────────────────────────────────────────────────────────────────
-- Migración: flujo encargado/apoyo completo
--   1. libro_turno.interino  — apoyo que abrió como encargado interino
--   2. Nuevos tipos de alerta: ausencia_encargado, ronda_asignada
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Flag interino en libro_turno
ALTER TABLE libro_turno
  ADD COLUMN IF NOT EXISTS interino BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Ampliar constraint de tipos de alerta (drop + re-create para añadir valores)
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
      'ronda_asignada'
    ]::text[])
  );

-- 3. Índice para consultas de ausencia por esquema + fecha
CREATE INDEX IF NOT EXISTS alertas_ausencia_encargado
  ON alertas (tipo, destinatario_id, created_at DESC)
  WHERE tipo = 'ausencia_encargado';
