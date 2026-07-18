-- MIGRACIÓN: nombre editable de las columnas estructurales "Número" y
-- "Ubicación" de la grilla de ítems, por tipo de planilla. Mismo patrón que
-- las columnas de chequeo (planilla_tipo_campos.etiqueta), pero estas dos
-- son inherentes a la tabla (no se pueden agregar/quitar, solo renombrar).

ALTER TABLE public.planilla_tipos
  ADD COLUMN IF NOT EXISTS etiqueta_numero text NOT NULL DEFAULT 'Número',
  ADD COLUMN IF NOT EXISTS etiqueta_ubicacion text NOT NULL DEFAULT 'Ubicación';

-- ROLLBACK
-- ALTER TABLE public.planilla_tipos DROP COLUMN IF EXISTS etiqueta_numero;
-- ALTER TABLE public.planilla_tipos DROP COLUMN IF EXISTS etiqueta_ubicacion;
