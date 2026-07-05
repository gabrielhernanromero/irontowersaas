-- Vincula incidencias generadas desde scan de ronda al punto de control específico
ALTER TABLE public.incidencias
  ADD COLUMN IF NOT EXISTS punto_control_id UUID REFERENCES public.puntos_control(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidencias_punto
  ON public.incidencias (punto_control_id)
  WHERE punto_control_id IS NOT NULL;

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_incidencias_punto;
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS punto_control_id;
