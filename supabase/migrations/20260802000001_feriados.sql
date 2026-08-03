-- MIGRACIÓN: Feriados (para el módulo de horas trabajadas / liquidación)
-- Calendario único, nacional, para toda la empresa. No se pre-carga con
-- fechas: el calendario (sobre todo los feriados puente) lo decreta el
-- gobierno año a año y hay que cargarlo a mano desde la UI.

CREATE TABLE public.feriados (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha      date NOT NULL UNIQUE,
  nombre     text NOT NULL,
  tipo       text NOT NULL CHECK (tipo IN ('nacional', 'puente')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

-- supervisor === dueño hoy (Iron Tower); revisar cuando haya supervisores
-- contratados que no sean dueños (multi-cliente CentralBase)
CREATE POLICY "feriados_select" ON public.feriados
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor'));

CREATE POLICY "feriados_insert" ON public.feriados
  FOR INSERT WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor'));

CREATE POLICY "feriados_update" ON public.feriados
  FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor'));

CREATE POLICY "feriados_delete" ON public.feriados
  FOR DELETE USING ((auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor'));

CREATE INDEX idx_feriados_fecha ON public.feriados (fecha);

-- ROLLBACK
-- DROP INDEX IF EXISTS idx_feriados_fecha;
-- DROP TABLE IF EXISTS public.feriados;
