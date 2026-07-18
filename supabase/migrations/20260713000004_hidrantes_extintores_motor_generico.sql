-- MIGRACIÓN: interruptor opt-in para que Hidrantes/Extintores pasen a usar
-- el motor genérico de planillas (columnas/nombre/tipo editables), por
-- cliente. Por defecto queda en false: nada cambia hasta que el supervisor
-- lo activa explícitamente desde la UI. Ver plan "Migrar Hidrantes/
-- Extintores al motor genérico" — las tablas planilla_hidrantes/
-- planilla_extintores con datos históricos NO se tocan.

ALTER TABLE public.planilla_tipos
  ADD COLUMN IF NOT EXISTS usa_motor_generico boolean NOT NULL DEFAULT false;

-- ROLLBACK
-- ALTER TABLE public.planilla_tipos DROP COLUMN IF EXISTS usa_motor_generico;
