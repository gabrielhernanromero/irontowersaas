-- Agrega campo activo a clientes para soft-delete de puestos
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- ROLLBACK:
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS activo;
