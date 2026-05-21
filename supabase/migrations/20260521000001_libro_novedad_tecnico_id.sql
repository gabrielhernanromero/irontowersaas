-- Agrega autor directo a cada novedad para atribución correcta en historial
ALTER TABLE public.libro_novedad
  ADD COLUMN IF NOT EXISTS tecnico_id uuid REFERENCES public.users(id);

-- Backfill: llenar tecnico_id desde el turno para registros existentes
UPDATE public.libro_novedad ln
  SET tecnico_id = lt.tecnico_id
  FROM public.libro_turno lt
  WHERE ln.turno_id = lt.id
  AND ln.tecnico_id IS NULL;

-- Trigger: auto-fill tecnico_id si se omite en futuros inserts
CREATE OR REPLACE FUNCTION public.fill_novedad_tecnico_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tecnico_id IS NULL THEN
    SELECT tecnico_id INTO NEW.tecnico_id FROM public.libro_turno WHERE id = NEW.turno_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS novedad_fill_tecnico ON public.libro_novedad;
CREATE TRIGGER novedad_fill_tecnico
  BEFORE INSERT ON public.libro_novedad
  FOR EACH ROW EXECUTE FUNCTION public.fill_novedad_tecnico_id();
