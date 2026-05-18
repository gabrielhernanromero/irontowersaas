-- MIGRACIÓN: Agregar turno_habitual a users

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS turno_habitual text
  CHECK (turno_habitual IN ('diurno', 'nocturno'));

-- ROLLBACK
-- ALTER TABLE public.users DROP COLUMN IF EXISTS turno_habitual;
