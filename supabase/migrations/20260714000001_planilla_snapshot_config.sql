-- Snapshot de {tipo_nombre, campos} tomado al momento del envío de una
-- planilla genérica. El PDF debe leer esto en vez de la config viva de
-- planilla_tipo_campos, para que renombrar/eliminar una columna después no
-- altere el informe de una planilla ya inmutable (Regla 2 + Regla 6).
ALTER TABLE public.planillas
  ADD COLUMN IF NOT EXISTS snapshot_config jsonb;
