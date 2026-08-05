-- MIGRACIÓN: Vigencia por fecha en tarifas_turno
--
-- Problema: hoy tarifas_turno guarda un único valor "actual" por
-- (tipo, tecnico_id) — si se edita, el cálculo de $ de TODOS los turnos
-- históricos cambia retroactivamente la próxima vez que se genera el
-- reporte, aunque ya se hayan pagado con la tarifa vieja.
--
-- Fix: agregar vigente_desde. Editar una tarifa ya NO pisa el valor
-- anterior — inserta una fila nueva "desde hoy en adelante". El cálculo
-- de cada turno usa la tarifa vigente en LA FECHA DE ESE TURNO, no la de
-- hoy, así que un cambio de tarifa nunca modifica lo ya calculado para
-- turnos pasados.

ALTER TABLE public.tarifas_turno
  ADD COLUMN IF NOT EXISTS vigente_desde date NOT NULL DEFAULT CURRENT_DATE;

-- Los índices únicos viejos (uno por tipo/técnico, sin fecha) ya no
-- alcanzan: ahora puede haber varias filas por tipo/técnico, una por
-- vigencia. Se reemplazan por versiones que incluyen vigente_desde.
DROP INDEX IF EXISTS idx_tarifa_base;
DROP INDEX IF EXISTS idx_tarifa_override;

CREATE UNIQUE INDEX idx_tarifa_base
  ON public.tarifas_turno (tipo, vigente_desde) WHERE tecnico_id IS NULL;

CREATE UNIQUE INDEX idx_tarifa_override
  ON public.tarifas_turno (tecnico_id, tipo, vigente_desde) WHERE tecnico_id IS NOT NULL;

-- ROLLBACK
-- DROP INDEX IF EXISTS idx_tarifa_override;
-- DROP INDEX IF EXISTS idx_tarifa_base;
-- CREATE UNIQUE INDEX idx_tarifa_base ON public.tarifas_turno (tipo) WHERE tecnico_id IS NULL;
-- CREATE UNIQUE INDEX idx_tarifa_override ON public.tarifas_turno (tecnico_id, tipo) WHERE tecnico_id IS NOT NULL;
-- ALTER TABLE public.tarifas_turno DROP COLUMN IF EXISTS vigente_desde;
