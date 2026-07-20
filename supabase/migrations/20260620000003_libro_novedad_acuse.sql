-- Acuse de recibo de alertas del apoyo por el encargado
ALTER TABLE libro_novedad
  ADD COLUMN IF NOT EXISTS acusado_en  timestamptz,
  ADD COLUMN IF NOT EXISTS acusado_por uuid REFERENCES auth.users(id);
