-- Agrega el estado intermedio 'pendiente_relevo' al libro_turno
-- Un turno pasa a pendiente_relevo cuando el técnico saliente cierra su guardia
-- y queda esperando que el técnico entrante firme el relevo.
-- Solo pasa a 'cerrado' cuando se completa el relevo atómicamente.

ALTER TABLE public.libro_turno
  DROP CONSTRAINT IF EXISTS libro_turno_estado_check;

ALTER TABLE public.libro_turno
  ADD CONSTRAINT libro_turno_estado_check
  CHECK (estado IN ('abierto', 'pendiente_relevo', 'cerrado'));

-- ROLLBACK:
-- ALTER TABLE public.libro_turno DROP CONSTRAINT libro_turno_estado_check;
-- ALTER TABLE public.libro_turno ADD CONSTRAINT libro_turno_estado_check CHECK (estado IN ('abierto', 'cerrado'));
