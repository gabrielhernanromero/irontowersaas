-- MIGRACIÓN: Planillas de tipo libre (motor genérico)
--
-- Permite al supervisor crear tipos de planilla nuevos más allá de
-- hidrantes/extintores ("planillas de lo que sea"), cada uno con sus propios
-- campos de chequeo (boolean OK/NO + observación obligatoria si NO, igual
-- que gabinete/manga/lanza/válvula hoy). Hidrantes y extintores NO se tocan:
-- siguen con sus tablas/rutas/PDFs propios (Regla 2 — no se toca el camino
-- que ya escribe documentos legales inmutables). Se los representa acá como
-- dos filas "legacy" en planilla_tipos solo para que aparezcan listados
-- junto a los tipos nuevos en la misma pantalla de configuración.

-- ─── 1. Tipos de planilla ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planilla_tipos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre     text        NOT NULL,
  slug       text        NOT NULL,
  es_legacy  boolean     NOT NULL DEFAULT false,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, slug)
);

ALTER TABLE public.planilla_tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planilla_tipos_select" ON public.planilla_tipos;
CREATE POLICY "planilla_tipos_select" ON public.planilla_tipos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.cliente_id = cliente_id OR u.rol IN ('admin', 'supervisor'))
    )
  );

DROP POLICY IF EXISTS "planilla_tipos_insert" ON public.planilla_tipos;
CREATE POLICY "planilla_tipos_insert" ON public.planilla_tipos
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planilla_tipos_update" ON public.planilla_tipos;
CREATE POLICY "planilla_tipos_update" ON public.planilla_tipos
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planilla_tipos_delete" ON public.planilla_tipos;
CREATE POLICY "planilla_tipos_delete" ON public.planilla_tipos
  FOR DELETE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
    AND es_legacy = false
  );

-- Seed: cada cliente existente recibe sus 2 tipos legacy (idempotente)
INSERT INTO public.planilla_tipos (cliente_id, nombre, slug, es_legacy)
SELECT c.id, 'Hidrantes', 'hidrantes', true FROM public.clientes c
ON CONFLICT (cliente_id, slug) DO NOTHING;

INSERT INTO public.planilla_tipos (cliente_id, nombre, slug, es_legacy)
SELECT c.id, 'Extintores', 'extintores', true FROM public.clientes c
ON CONFLICT (cliente_id, slug) DO NOTHING;

-- ─── 2. Campos de chequeo por tipo ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planilla_tipo_campos (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  planilla_tipo_id uuid    NOT NULL REFERENCES public.planilla_tipos(id) ON DELETE CASCADE,
  clave            text    NOT NULL,
  etiqueta         text    NOT NULL,
  orden            integer NOT NULL DEFAULT 0,
  UNIQUE (planilla_tipo_id, clave)
);

ALTER TABLE public.planilla_tipo_campos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planilla_tipo_campos_select" ON public.planilla_tipo_campos;
CREATE POLICY "planilla_tipo_campos_select" ON public.planilla_tipo_campos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.planilla_tipos pt
      JOIN public.users u ON u.id = auth.uid()
      WHERE pt.id = planilla_tipo_id
        AND (u.cliente_id = pt.cliente_id OR u.rol IN ('admin', 'supervisor'))
    )
  );

DROP POLICY IF EXISTS "planilla_tipo_campos_insert" ON public.planilla_tipo_campos;
CREATE POLICY "planilla_tipo_campos_insert" ON public.planilla_tipo_campos
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planilla_tipo_campos_update" ON public.planilla_tipo_campos;
CREATE POLICY "planilla_tipo_campos_update" ON public.planilla_tipo_campos
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planilla_tipo_campos_delete" ON public.planilla_tipo_campos;
CREATE POLICY "planilla_tipo_campos_delete" ON public.planilla_tipo_campos
  FOR DELETE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- ─── 3. Respuestas de ítems para tipos genéricos ──────────────────────────
-- Paralela a planilla_hidrantes/planilla_extintores, pero para cualquier tipo
-- no-legacy. "respuestas"/"observaciones" son jsonb keyed por
-- planilla_tipo_campos.clave — igual que gabinete/obs_gabinete pero dinámico.
CREATE TABLE IF NOT EXISTS public.planilla_item_respuestas (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  planilla_id   uuid  NOT NULL REFERENCES public.planillas(id),
  numero        text  NOT NULL,
  respuestas    jsonb NOT NULL DEFAULT '{}',
  observaciones jsonb NOT NULL DEFAULT '{}',
  foto_url      text
);

ALTER TABLE public.planilla_item_respuestas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planilla_item_respuestas_select" ON public.planilla_item_respuestas;
CREATE POLICY "planilla_item_respuestas_select" ON public.planilla_item_respuestas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.planillas p
      WHERE p.id = planilla_id
        AND (
          p.tecnico_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.rol IN ('admin', 'supervisor'))
        )
    )
  );

DROP POLICY IF EXISTS "planilla_item_respuestas_insert" ON public.planilla_item_respuestas;
CREATE POLICY "planilla_item_respuestas_insert" ON public.planilla_item_respuestas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planillas p
      WHERE p.id = planilla_id
        AND p.inmutable = false
        AND (
          p.tecnico_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.rol IN ('admin', 'supervisor'))
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_planilla_item_respuestas_planilla
  ON public.planilla_item_respuestas (planilla_id);

-- ─── 4. Relajar CHECK constraints para aceptar slugs nuevos ───────────────
-- Matchea por columna exacta (no por nombre de constraint hardcodeado) y por
-- array_length(conkey,1)=1 para no tocar el CHECK compuesto de tipo_extintor
-- (que también referencia la columna "tipo" pero junto con otra columna).
DO $$
DECLARE conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'planillas' AND c.contype = 'c' AND a.attname = 'tipo'
    AND array_length(c.conkey, 1) = 1;
  IF conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.planillas DROP CONSTRAINT ' || quote_ident(conname);
  END IF;
END;
$$;

DO $$
DECLARE conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE t.relname = 'planilla_items_config' AND c.contype = 'c' AND a.attname = 'tipo'
    AND array_length(c.conkey, 1) = 1;
  IF conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.planilla_items_config DROP CONSTRAINT ' || quote_ident(conname);
  END IF;
END;
$$;

-- ROLLBACK
-- ALTER TABLE public.planillas ADD CONSTRAINT planillas_tipo_check CHECK (tipo IN ('hidrantes','extintores'));
-- ALTER TABLE public.planilla_items_config ADD CONSTRAINT planilla_items_config_tipo_check CHECK (tipo IN ('hidrantes','extintores'));
-- DROP TABLE IF EXISTS public.planilla_item_respuestas;
-- DROP TABLE IF EXISTS public.planilla_tipo_campos;
-- DROP TABLE IF EXISTS public.planilla_tipos;
