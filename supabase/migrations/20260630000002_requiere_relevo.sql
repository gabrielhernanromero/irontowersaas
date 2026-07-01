-- Agrega la columna requiere_relevo a esquemas_cobertura.
-- El supervisor indica explícitamente si este turno requiere relevo del saliente.
-- false (default) = el turno cierra limpio; true = queda pendiente_relevo.
ALTER TABLE esquemas_cobertura
  ADD COLUMN IF NOT EXISTS requiere_relevo BOOLEAN NOT NULL DEFAULT false;
