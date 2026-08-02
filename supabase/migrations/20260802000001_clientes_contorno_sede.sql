-- GPS Fase 1.5: contorno de la sede dibujado a mano por el supervisor sobre
-- un mapa satelital (Leaflet + Esri World Imagery). Es una capa visual —
-- la geocerca sigue siendo círculo+radio (Haversine), no point-in-polygon.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS contorno_geojson JSONB,
  ADD COLUMN IF NOT EXISTS contorno_actualizado_at TIMESTAMPTZ;

-- ROLLBACK:
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS contorno_geojson;
-- ALTER TABLE public.clientes DROP COLUMN IF EXISTS contorno_actualizado_at;
