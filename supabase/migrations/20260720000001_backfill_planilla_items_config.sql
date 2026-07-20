-- BACKFILL: planilla_items_config es una tabla nueva (20260713000001) que
-- reemplazó el hardcodeo de números de hidrantes/extintores, pero nunca se
-- migraron los clientes existentes — sin esto, el catálogo queda vacío y el
-- técnico ve la planilla sin filas para completar (bug crítico detectado en
-- producción tras el deploy). Reconstruye el catálogo a partir de los
-- números que cada cliente ya usaba en su historial real de planillas
-- enviadas. Idempotente vía ON CONFLICT DO NOTHING (unique cliente_id+tipo+numero).

WITH hidrantes_distintos AS (
  SELECT DISTINCT p.cliente_id, h.numero
  FROM public.planilla_hidrantes h
  JOIN public.planillas p ON p.id = h.planilla_id
)
INSERT INTO public.planilla_items_config (cliente_id, tipo, numero, orden, activo)
SELECT
  cliente_id,
  'hidrantes',
  numero,
  ROW_NUMBER() OVER (
    PARTITION BY cliente_id
    ORDER BY (CASE WHEN numero ~ '^[0-9]+$' THEN numero::int END) NULLS LAST, numero
  ) - 1,
  true
FROM hidrantes_distintos
ON CONFLICT (cliente_id, tipo, numero) DO NOTHING;

WITH extintores_distintos AS (
  SELECT DISTINCT ON (p.cliente_id, e.numero)
    p.cliente_id, e.numero, e.tipo AS tipo_extintor
  FROM public.planilla_extintores e
  JOIN public.planillas p ON p.id = e.planilla_id
  ORDER BY p.cliente_id, e.numero, p.fecha DESC, p.created_at DESC
)
INSERT INTO public.planilla_items_config (cliente_id, tipo, numero, tipo_extintor, orden, activo)
SELECT
  cliente_id,
  'extintores',
  numero,
  tipo_extintor,
  ROW_NUMBER() OVER (
    PARTITION BY cliente_id
    ORDER BY (CASE WHEN numero ~ '^[0-9]+$' THEN numero::int END) NULLS LAST, numero
  ) - 1,
  true
FROM extintores_distintos
ON CONFLICT (cliente_id, tipo, numero) DO NOTHING;

-- ROLLBACK
-- delete from public.planilla_items_config where created_at > 'AGREGAR TIMESTAMP DE ESTA MIGRACIÓN';
