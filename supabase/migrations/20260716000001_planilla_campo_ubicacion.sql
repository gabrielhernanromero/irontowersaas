-- Sexto tipo de campo: "ubicacion" — se comporta igual que "texto" (string
-- no vacío, sin observación, nunca dispara Regla 4), solo cambia el ícono
-- y la etiqueta en el selector del supervisor.
ALTER TABLE public.planilla_tipo_campos
  DROP CONSTRAINT IF EXISTS planilla_tipo_campos_tipo_campo_check;
ALTER TABLE public.planilla_tipo_campos
  ADD CONSTRAINT planilla_tipo_campos_tipo_campo_check
    CHECK (tipo_campo IN ('check', 'select', 'texto', 'numero', 'fecha', 'ubicacion'));
