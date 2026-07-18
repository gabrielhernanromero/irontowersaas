-- Nuevos tipos de campo para el motor genérico: texto libre, numérico (con
-- rango esperado) y fecha, sumados a los ya existentes check/select.
ALTER TABLE public.planilla_tipo_campos
  DROP CONSTRAINT IF EXISTS planilla_tipo_campos_tipo_campo_check;
ALTER TABLE public.planilla_tipo_campos
  ADD CONSTRAINT planilla_tipo_campos_tipo_campo_check
    CHECK (tipo_campo IN ('check', 'select', 'texto', 'numero', 'fecha'));

ALTER TABLE public.planilla_tipo_campos
  ADD COLUMN IF NOT EXISTS valor_min numeric,
  ADD COLUMN IF NOT EXISTS valor_max numeric;
