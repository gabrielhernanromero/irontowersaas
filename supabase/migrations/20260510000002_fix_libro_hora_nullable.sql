-- MIGRACIÓN: hora de novedad pasa a nullable (NULL cuando sin_novedades=true)

ALTER TABLE public.libro_guardia
  ALTER COLUMN hora DROP NOT NULL;

-- ROLLBACK
-- ALTER TABLE public.libro_guardia ALTER COLUMN hora SET NOT NULL;
