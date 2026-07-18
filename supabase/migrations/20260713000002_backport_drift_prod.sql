-- BACKPORT: columnas que existen en producción pero nunca quedaron
-- documentadas como migración (drift detectado al clonar prod → staging
-- por primera vez el 2026-07-13, corriendo `supabase db push` contra un
-- proyecto nuevo). Alguien las agregó directamente en producción (vía SQL
-- Editor, probablemente) sin dejar el archivo de migración correspondiente.
--
-- Definiciones tomadas directo de information_schema/pg_constraint de prod.

ALTER TABLE public.libro_novedad
  ADD COLUMN IF NOT EXISTS planilla_id   uuid REFERENCES public.planillas(id),
  ADD COLUMN IF NOT EXISTS incidencia_id uuid REFERENCES public.incidencias(id) ON DELETE SET NULL;

ALTER TABLE public.informes
  ADD COLUMN IF NOT EXISTS planilla_ids uuid[] DEFAULT '{}'::uuid[];

-- ROLLBACK
-- ALTER TABLE public.informes DROP COLUMN IF EXISTS planilla_ids;
-- ALTER TABLE public.libro_novedad DROP COLUMN IF EXISTS incidencia_id;
-- ALTER TABLE public.libro_novedad DROP COLUMN IF EXISTS planilla_id;
