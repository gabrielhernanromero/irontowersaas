-- Vincula cada scan de ronda con la novedad que generó (opcional)
ALTER TABLE ronda_scans ADD COLUMN IF NOT EXISTS novedad_id uuid REFERENCES libro_novedad(id);
