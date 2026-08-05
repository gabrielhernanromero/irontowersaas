-- MIGRACIÓN: La excepción de un técnico es un precio único, sin "tipo"
--
-- Antes: un técnico podía tener una excepción distinta por tipo de turno
-- (diurno/nocturno/feriado). Se simplifica: la excepción de un técnico es
-- UN solo precio, que reemplaza al precio general/específico para
-- cualquier turno de esa persona, sin distinguir tipo.
--
-- tipo pasa a ser NULL en las filas de excepción (tecnico_id NOT NULL); las
-- filas de precio base (tecnico_id NULL) siguen requiriendo un tipo.

ALTER TABLE public.tarifas_turno ALTER COLUMN tipo DROP NOT NULL;

-- Cualquier excepción vieja (con tipo cargado) pasa a valer para todo tipo.
UPDATE public.tarifas_turno SET tipo = NULL WHERE tecnico_id IS NOT NULL;

ALTER TABLE public.tarifas_turno DROP CONSTRAINT IF EXISTS tarifas_turno_tipo_check;
ALTER TABLE public.tarifas_turno ADD CONSTRAINT tarifas_turno_tipo_check CHECK (
  (tecnico_id IS NULL     AND tipo IN ('diurno', 'nocturno', 'feriado_nacional', 'feriado_puente'))
  OR
  (tecnico_id IS NOT NULL AND tipo IS NULL)
);

DROP INDEX IF EXISTS idx_tarifa_override;
CREATE UNIQUE INDEX idx_tarifa_override
  ON public.tarifas_turno (tecnico_id, vigente_desde) WHERE tecnico_id IS NOT NULL;

-- ROLLBACK
-- DROP INDEX IF EXISTS idx_tarifa_override;
-- CREATE UNIQUE INDEX idx_tarifa_override ON public.tarifas_turno (tecnico_id, tipo, vigente_desde) WHERE tecnico_id IS NOT NULL;
-- ALTER TABLE public.tarifas_turno DROP CONSTRAINT IF EXISTS tarifas_turno_tipo_check;
-- ALTER TABLE public.tarifas_turno ALTER COLUMN tipo SET NOT NULL;
