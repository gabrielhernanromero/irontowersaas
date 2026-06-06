-- MIGRACIÓN: Rol habitual del técnico en su puesto
-- Permite al supervisor saber si el técnico es habitualmente encargado o apoyo.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS rol_habitual text
    CHECK (rol_habitual IN ('encargado', 'apoyo'));

-- Actualizar seed de prueba si existe
UPDATE public.users SET rol_habitual = 'encargado'
  WHERE id IN (
    'b0000001-0000-0000-0000-000000000001',
    'b0000003-0000-0000-0000-000000000003'
  );
UPDATE public.users SET rol_habitual = 'apoyo'
  WHERE id IN (
    'b0000002-0000-0000-0000-000000000002',
    'b0000004-0000-0000-0000-000000000004'
  );

-- ROLLBACK
-- ALTER TABLE public.users DROP COLUMN IF EXISTS rol_habitual;
