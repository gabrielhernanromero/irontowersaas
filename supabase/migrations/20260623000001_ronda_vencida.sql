-- ── Ronda vencida: alertas con resolución supervisora ────────────────────────

-- 1. Ampliar CHECK de alertas.tipo para incluir ronda_vencida
ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check CHECK (
  tipo = ANY (ARRAY[
    'novedad_planilla',
    'planilla_pendiente',
    'certificacion_vence',
    'ronda_proxima',
    'ronda_vencida'
  ])
);

-- 2. Campos de resolución en alertas
ALTER TABLE public.alertas
  ADD COLUMN IF NOT EXISTS resuelta               boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resuelta_en            timestamptz,
  ADD COLUMN IF NOT EXISTS resolucion_observacion text,
  ADD COLUMN IF NOT EXISTS resuelta_por           uuid        REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS turno_id               uuid        REFERENCES public.libro_turno(id),
  ADD COLUMN IF NOT EXISTS novedad_id             uuid        REFERENCES public.libro_novedad(id);

-- 3. Índice para queries del cron (deduplicación ronda_vencida por turno)
CREATE INDEX IF NOT EXISTS alertas_tipo_turno
  ON public.alertas (tipo, turno_id, created_at DESC)
  WHERE turno_id IS NOT NULL;

-- 4. Ampliar CHECK de libro_novedad.tipo para novedades generadas por el sistema
ALTER TABLE public.libro_novedad DROP CONSTRAINT IF EXISTS libro_novedad_tipo_check;
ALTER TABLE public.libro_novedad ADD CONSTRAINT libro_novedad_tipo_check CHECK (
  tipo IN ('apertura', 'novedad', 'cierre', 'alerta', 'sistema')
);

-- ── ROLLBACK ─────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS alertas_tipo_turno;
-- ALTER TABLE public.alertas DROP COLUMN IF EXISTS novedad_id;
-- ALTER TABLE public.alertas DROP COLUMN IF EXISTS turno_id;
-- ALTER TABLE public.alertas DROP COLUMN IF EXISTS resuelta_por;
-- ALTER TABLE public.alertas DROP COLUMN IF EXISTS resolucion_observacion;
-- ALTER TABLE public.alertas DROP COLUMN IF EXISTS resuelta_en;
-- ALTER TABLE public.alertas DROP COLUMN IF EXISTS resuelta;
-- ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
-- ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check CHECK (
--   tipo = ANY (ARRAY['novedad_planilla','planilla_pendiente','certificacion_vence','ronda_proxima'])
-- );
-- ALTER TABLE public.libro_novedad DROP CONSTRAINT IF EXISTS libro_novedad_tipo_check;
-- ALTER TABLE public.libro_novedad ADD CONSTRAINT libro_novedad_tipo_check CHECK (
--   tipo IN ('apertura', 'novedad', 'cierre', 'alerta')
-- );
