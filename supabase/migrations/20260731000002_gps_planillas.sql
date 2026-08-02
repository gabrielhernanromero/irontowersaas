-- GPS Fase 1: coordenadas capturadas al firmar una planilla.
-- gps_capturado_at es distinto de enviada_at: el fix de GPS se pide en
-- background al abrir el formulario, no al momento del envío, así que puede
-- quedar desactualizado respecto al envío real (importante para auditoría).
ALTER TABLE public.planillas
  ADD COLUMN IF NOT EXISTS firma_latitud          DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS firma_longitud         DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS firma_precision_m      DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS firma_gps_capturado_at TIMESTAMPTZ;

-- Sin RLS nueva: estas columnas se setean en el mismo INSERT que crea la fila,
-- antes del UPDATE posterior que fija inmutable=true — la policy existente
-- "planillas_update_mutable_only" ya las protege automáticamente.

-- ROLLBACK:
-- ALTER TABLE public.planillas DROP COLUMN IF EXISTS firma_latitud;
-- ALTER TABLE public.planillas DROP COLUMN IF EXISTS firma_longitud;
-- ALTER TABLE public.planillas DROP COLUMN IF EXISTS firma_precision_m;
-- ALTER TABLE public.planillas DROP COLUMN IF EXISTS firma_gps_capturado_at;
