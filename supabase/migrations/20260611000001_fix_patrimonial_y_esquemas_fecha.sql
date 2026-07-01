-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: código patrimonial → unicidad por cliente (no global)
-- ─────────────────────────────────────────────────────────────────────────────

-- Supabase creó un unique global; lo reemplazamos por uno compuesto (cliente + código)
ALTER TABLE public.elementos_puesto
  DROP CONSTRAINT IF EXISTS elementos_puesto_codigo_patrimonial_key;

DROP INDEX IF EXISTS public.elementos_puesto_codigo_patrimonial_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_elementos_codigo_por_cliente
  ON public.elementos_puesto (cliente_id, codigo_patrimonial);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 2: fecha_desde en esquemas_cobertura (desde cuándo aplica el turno)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.esquemas_cobertura
  ADD COLUMN IF NOT EXISTS fecha_desde date NOT NULL DEFAULT CURRENT_DATE;
