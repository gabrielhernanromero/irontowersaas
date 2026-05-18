-- MIGRACIÓN: Asignar técnicos a empresa cliente

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

-- ROLLBACK
-- ALTER TABLE public.users DROP COLUMN IF EXISTS cliente_id;
