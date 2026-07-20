-- MIGRACIÓN: Catálogo configurable de ítems de planilla + plano de planta
--
-- Reemplaza el hardcodeo de 48 hidrantes / cantidad manual de extintores por un
-- catálogo que el supervisor gestiona por cliente antes de que arranque el turno.
-- Las tablas planilla_hidrantes / planilla_extintores NO referencian este catálogo
-- (guardan "numero" como texto plano) — así una edición futura del catálogo nunca
-- puede alterar una planilla ya enviada (inmutable=true, Regla 2).

-- ─── 1. Catálogo de ítems por cliente ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planilla_items_config (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo          text        NOT NULL CHECK (tipo IN ('hidrantes', 'extintores')),
  numero        text        NOT NULL,
  tipo_extintor text        CHECK (tipo_extintor IS NULL OR tipo = 'extintores'),
  ubicacion     text,
  orden         integer     NOT NULL DEFAULT 0,
  activo        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, tipo, numero)
);

ALTER TABLE public.planilla_items_config ENABLE ROW LEVEL SECURITY;

-- Técnicos del cliente + supervisor/admin pueden leer el catálogo
DROP POLICY IF EXISTS "planilla_items_select" ON public.planilla_items_config;
CREATE POLICY "planilla_items_select" ON public.planilla_items_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.cliente_id = cliente_id OR u.rol IN ('admin', 'supervisor'))
    )
  );

-- Solo supervisor/admin gestionan el catálogo
DROP POLICY IF EXISTS "planilla_items_insert" ON public.planilla_items_config;
CREATE POLICY "planilla_items_insert" ON public.planilla_items_config
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planilla_items_update" ON public.planilla_items_config;
CREATE POLICY "planilla_items_update" ON public.planilla_items_config
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planilla_items_delete" ON public.planilla_items_config;
CREATE POLICY "planilla_items_delete" ON public.planilla_items_config
  FOR DELETE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

CREATE INDEX IF NOT EXISTS idx_planilla_items_cliente_tipo
  ON public.planilla_items_config (cliente_id, tipo, activo);

-- ─── 2. Plano / croquis de planta (uno activo por cliente) ──────────────────
-- "path" es la ruta dentro del bucket privado "planos" (NO una URL pública) —
-- se resuelve a una signed URL de corta duración en cada Route Handler que
-- necesite mostrar la imagen (ver src/app/api/supervisor/planos/route.ts).
CREATE TABLE IF NOT EXISTS public.planos_planta (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  path        text        NOT NULL,
  nombre      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planos_planta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planos_planta_select" ON public.planos_planta;
CREATE POLICY "planos_planta_select" ON public.planos_planta
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.cliente_id = cliente_id OR u.rol IN ('admin', 'supervisor'))
    )
  );

DROP POLICY IF EXISTS "planos_planta_insert" ON public.planos_planta;
CREATE POLICY "planos_planta_insert" ON public.planos_planta
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planos_planta_update" ON public.planos_planta;
CREATE POLICY "planos_planta_update" ON public.planos_planta
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planos_planta_delete" ON public.planos_planta;
CREATE POLICY "planos_planta_delete" ON public.planos_planta
  FOR DELETE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- ─── 3. Bucket de Storage para los planos (PRIVADO — se sirve vía signed URL) ─
-- A diferencia de "fotos" (pública), un plano de planta expone el layout
-- completo del predio del cliente (accesos, ubicación de hidrantes/matafuegos),
-- así que el bucket queda privado y el acceso se resuelve con
-- createSignedUrl() desde Route Handlers autenticados, nunca con URL pública.
INSERT INTO storage.buckets (id, name, public)
VALUES ('planos', 'planos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "planos_bucket_insert" ON storage.objects;
CREATE POLICY "planos_bucket_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'planos'
    AND (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planos_bucket_update" ON storage.objects;
CREATE POLICY "planos_bucket_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'planos'
    AND (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS "planos_bucket_delete" ON storage.objects;
CREATE POLICY "planos_bucket_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'planos'
    AND (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- Sin policy de SELECT pública: el objeto solo se lee vía signed URL generada
-- por supabaseAdmin() en el servidor (bypasea RLS), nunca por acceso directo
-- del cliente. Igual se agrega una policy explícita para admin/supervisor
-- como defensa en profundidad, consistente con insert/update/delete.
DROP POLICY IF EXISTS "planos_bucket_select" ON storage.objects;
CREATE POLICY "planos_bucket_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'planos'
    AND (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- ROLLBACK
-- delete from storage.buckets where id = 'planos';
-- drop table if exists public.planos_planta;
-- drop table if exists public.planilla_items_config;
