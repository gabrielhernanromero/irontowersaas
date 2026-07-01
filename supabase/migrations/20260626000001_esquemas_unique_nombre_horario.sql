-- Índice único case-insensitive sobre nombre por cliente.
-- Impide duplicados como "Mañana" / "mañana" / "MAÑANA".
CREATE UNIQUE INDEX IF NOT EXISTS esquemas_unique_nombre_cliente_ci
  ON esquemas_cobertura (cliente_id, LOWER(TRIM(nombre)));

-- Índice único sobre franja horaria por cliente.
-- Impide dos turnos con exactamente el mismo horario para el mismo puesto.
CREATE UNIQUE INDEX IF NOT EXISTS esquemas_unique_horario_cliente
  ON esquemas_cobertura (cliente_id, hora_inicio, hora_fin);
