-- ── Turno sin cerrar: aviso al supervisor ────────────────────────────────────

-- 1. Campo para deduplicar el aviso (un solo aviso por turno bloqueante)
ALTER TABLE public.libro_turno
  ADD COLUMN IF NOT EXISTS aviso_supervisor_at timestamptz;

-- 2. Ampliar CHECK de alertas.tipo para incluir turno_sin_cerrar
--    (incluye todos los tipos existentes para no romper el constraint)
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
    'turno_sin_cerrar'
  ])
);

-- ── ROLLBACK ─────────────────────────────────────────────────────────────────
-- ALTER TABLE public.libro_turno DROP COLUMN IF EXISTS aviso_supervisor_at;
-- ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
-- ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check CHECK (
--   tipo = ANY (ARRAY[
--     'novedad_planilla','planilla_pendiente','certificacion_vence',
--     'ronda_proxima','ronda_vencida','ausencia_encargado',
--     'ronda_asignada','novedad_apoyo','cierre_anticipado'
--   ])
-- );
