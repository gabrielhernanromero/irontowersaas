-- Agrega configuración de planillas habilitadas por cliente.
-- Por defecto ambas planillas (hidrantes y extintores) están habilitadas.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS planillas_habilitadas text[]
    NOT NULL DEFAULT ARRAY['hidrantes', 'extintores'];
