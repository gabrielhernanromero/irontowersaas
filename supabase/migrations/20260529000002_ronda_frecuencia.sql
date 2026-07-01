-- ── Frecuencia de rondas por cliente ────────────────────────
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS frecuencia_ronda_minutos INTEGER,
  ADD COLUMN IF NOT EXISTS aviso_ronda_minutos      INTEGER NOT NULL DEFAULT 10;

-- ── Ampliar CHECK constraint de alertas.tipo ─────────────────
ALTER TABLE public.alertas
  DROP CONSTRAINT IF EXISTS alertas_tipo_check;

ALTER TABLE public.alertas
  ADD CONSTRAINT alertas_tipo_check CHECK (
    tipo = ANY (ARRAY[
      'novedad_planilla'::text,
      'planilla_pendiente'::text,
      'certificacion_vence'::text,
      'ronda_proxima'::text
    ])
  );

-- ── ROLLBACK ─────────────────────────────────────────────────
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS frecuencia_ronda_minutos;
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS aviso_ronda_minutos;
-- ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
-- ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check CHECK (
--   tipo = ANY (ARRAY['novedad_planilla','planilla_pendiente','certificacion_vence'])
-- );
