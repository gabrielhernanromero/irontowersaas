-- MIGRACIÓN: Enlazar planillas con libro_turno

ALTER TABLE public.planillas
  ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES public.libro_turno(id) ON DELETE SET NULL;

-- ROLLBACK
-- ALTER TABLE public.planillas DROP COLUMN IF EXISTS turno_id;
