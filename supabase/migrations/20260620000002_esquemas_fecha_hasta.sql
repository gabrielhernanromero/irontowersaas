-- Agrega fecha de fin opcional a los esquemas de cobertura
-- NULL = vigencia indefinida (turno permanente)
ALTER TABLE public.esquemas_cobertura
  ADD COLUMN IF NOT EXISTS fecha_hasta date;
