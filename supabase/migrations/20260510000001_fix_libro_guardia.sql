-- MIGRACIÓN: Ajuste de libro_guardia según instructivo oficial

ALTER TABLE public.libro_guardia
  ADD COLUMN IF NOT EXISTS fecha          date,
  ADD COLUMN IF NOT EXISTS turno          text check (turno in ('diurno', 'nocturno')),
  ADD COLUMN IF NOT EXISTS horario_inicio time,
  ADD COLUMN IF NOT EXISTS horario_fin    time,
  ADD COLUMN IF NOT EXISTS descripcion    text,
  ADD COLUMN IF NOT EXISTS sin_novedades  boolean not null default false;

-- riesgo_detectado y medidas_adoptadas ahora son opcionales (vacíos cuando sin_novedades=true)
ALTER TABLE public.libro_guardia
  ALTER COLUMN riesgo_detectado DROP NOT NULL,
  ALTER COLUMN medidas_adoptadas DROP NOT NULL;

-- ROLLBACK
-- ALTER TABLE public.libro_guardia
--   DROP COLUMN IF EXISTS sin_novedades,
--   DROP COLUMN IF EXISTS descripcion,
--   DROP COLUMN IF EXISTS horario_fin,
--   DROP COLUMN IF EXISTS horario_inicio,
--   DROP COLUMN IF EXISTS turno,
--   DROP COLUMN IF EXISTS fecha;
-- ALTER TABLE public.libro_guardia
--   ALTER COLUMN riesgo_detectado SET NOT NULL,
--   ALTER COLUMN medidas_adoptadas SET NOT NULL;
