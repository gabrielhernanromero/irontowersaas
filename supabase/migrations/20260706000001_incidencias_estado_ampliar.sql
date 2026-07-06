-- Ampliar el CHECK constraint de incidencias.estado para soportar
-- el flujo completo de rondas: abierto → en_seguimiento → cerrado

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'incidencias'
    AND c.contype = 'c'
    AND c.conname LIKE '%estado%';

  IF conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.incidencias DROP CONSTRAINT ' || quote_ident(conname);
  END IF;
END;
$$;

ALTER TABLE public.incidencias
  ADD CONSTRAINT incidencias_estado_check
  CHECK (estado IN ('abierto', 'resuelto', 'cerrado', 'en_seguimiento'));

-- Rollback:
-- ALTER TABLE public.incidencias DROP CONSTRAINT IF EXISTS incidencias_estado_check;
-- ALTER TABLE public.incidencias ADD CONSTRAINT incidencias_estado_check CHECK (estado IN ('abierto', 'resuelto'));
