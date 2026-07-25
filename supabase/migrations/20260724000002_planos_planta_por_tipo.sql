-- MIGRACIÓN: Plano de planta por tipo de planilla (no por cliente)
--
-- Hasta ahora "planos_planta" guardaba un único plano por cliente. En la
-- operación real cada tipo de elemento tiene su propio plano marcado (el
-- de matafuegos indica dónde está cada matafuego, el de hidrantes dónde
-- está cada hidrante, etc.), así que pasa a ser un plano por
-- (cliente_id, planilla_tipo_id).
--
-- La tabla solo existe en staging (demo), todavía no llegó a producción,
-- así que no hay backfill real que preservar: cualquier plano ya cargado
-- en demo queda huérfano y el supervisor lo vuelve a subir por tipo.

ALTER TABLE public.planos_planta
  ADD COLUMN IF NOT EXISTS planilla_tipo_id uuid REFERENCES public.planilla_tipos(id) ON DELETE CASCADE;

-- Limpia cualquier plano de demo cargado con el esquema viejo (sin tipo) —
-- ver comentario arriba, no hay backfill posible porque el plano viejo no
-- indica para qué tipo de elemento era.
DELETE FROM public.planos_planta WHERE planilla_tipo_id IS NULL;

ALTER TABLE public.planos_planta
  ALTER COLUMN planilla_tipo_id SET NOT NULL;

ALTER TABLE public.planos_planta
  DROP CONSTRAINT IF EXISTS planos_planta_cliente_id_key;

ALTER TABLE public.planos_planta
  ADD CONSTRAINT planos_planta_cliente_tipo_key UNIQUE (cliente_id, planilla_tipo_id);

CREATE INDEX IF NOT EXISTS idx_planos_planta_tipo
  ON public.planos_planta (planilla_tipo_id);

-- ROLLBACK
-- alter table public.planos_planta drop constraint if exists planos_planta_cliente_tipo_key;
-- alter table public.planos_planta alter column planilla_tipo_id drop not null;
-- alter table public.planos_planta add constraint planos_planta_cliente_id_key unique (cliente_id);
-- drop index if exists idx_planos_planta_tipo;
-- alter table public.planos_planta drop column if exists planilla_tipo_id;
