-- GPS Fase 1: coordenadas de la sede del cliente, cargadas a mano por el supervisor.
-- Se usan como referencia para la geocerca al firmar planillas y en el libro de guardia.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS latitud  DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS longitud DECIMAL(11,8);

-- ROLLBACK:
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS latitud;
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS longitud;
