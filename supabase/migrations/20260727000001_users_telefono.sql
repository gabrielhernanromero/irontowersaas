-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: teléfono de contacto de usuarios (encargado/apoyo)
--   Permite al supervisor contactar al personal que cubre un puesto desde
--   el detalle del turno en el dashboard. Columna aditiva, nullable, sin
--   impacto en filas existentes ni en políticas RLS (se lee en los mismos
--   selects que ya devuelven la tabla users).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS telefono text;

-- ─── ROLLBACK ────────────────────────────────────────────────────────────────────
-- ALTER TABLE public.users DROP COLUMN IF EXISTS telefono;
