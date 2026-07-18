-- MIGRACIÓN: campos de tipo "selección" (lista desplegable con opciones
-- configurables), como segundo tipo de campo de chequeo además del boolean
-- OK/NO. Mismo patrón que la columna "Tipo" de Extintores
-- (tipo_extintor/TIPOS_EXTINTOR) pero configurable y disponible para
-- cualquier tipo de planilla custom. No reemplaza el tipo_extintor
-- hardcodeado existente.

ALTER TABLE public.planilla_tipo_campos
  ADD COLUMN IF NOT EXISTS tipo_campo text NOT NULL DEFAULT 'check'
    CHECK (tipo_campo IN ('check', 'select')),
  ADD COLUMN IF NOT EXISTS opciones text[] NOT NULL DEFAULT '{}';

-- ROLLBACK
-- ALTER TABLE public.planilla_tipo_campos DROP COLUMN IF EXISTS opciones;
-- ALTER TABLE public.planilla_tipo_campos DROP COLUMN IF EXISTS tipo_campo;
