-- MIGRACIÓN: Campos del Flujo de Relevo Crítico (Especificación Técnica)

-- 1. PIN de 4 dígitos para autenticación de relevo en dispositivo compartido
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pin_hash text;

-- 2. Hash SHA-256 de novedades del turno — auditoría e inmutabilidad
ALTER TABLE public.libro_turno
  ADD COLUMN IF NOT EXISTS hash_novedades text;

-- 3. Objetivo/cliente donde se ejecuta la guardia
ALTER TABLE public.libro_turno
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

-- 4. Tabla incidencias — eventos que persisten de turno en turno
CREATE TABLE IF NOT EXISTS public.incidencias (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          uuid        NOT NULL REFERENCES public.clientes(id),
  turno_creacion_id   uuid        NOT NULL REFERENCES public.libro_turno(id),
  turno_cierre_id     uuid        REFERENCES public.libro_turno(id),
  titulo              varchar     NOT NULL,
  descripcion         text        NOT NULL,
  severidad           varchar     CHECK (severidad IN ('bajo', 'medio', 'alto')),
  estado              varchar     NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'resuelto')),
  foto_url            text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidencias_select" ON public.incidencias
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor', 'tecnico')
  );

CREATE POLICY "incidencias_insert" ON public.incidencias
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor', 'tecnico')
  );

-- Solo admin/supervisor pueden resolver (cambiar estado a 'resuelto')
CREATE POLICY "incidencias_update" ON public.incidencias
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- Sin DELETE — inmutables como todo el libro de guardia

-- 5. Bucket firmas-relevos — separado del bucket firmas general
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas-relevos', 'firmas-relevos', false)
ON CONFLICT (id) DO NOTHING;

-- Cualquier usuario autenticado puede subir (dispositivo compartido, Técnico B aún no tiene sesión activa)
CREATE POLICY "firmas_relevos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'firmas-relevos'
    AND auth.role() = 'authenticated'
  );

-- Supervisores y admins pueden ver todas las firmas; técnico ve las propias
CREATE POLICY "firmas_relevos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'firmas-relevos'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.rol IN ('admin', 'supervisor', 'tecnico')
    )
  );

-- ROLLBACK
-- DELETE FROM storage.buckets WHERE id = 'firmas-relevos';
-- DROP TABLE IF EXISTS public.incidencias;
-- ALTER TABLE public.libro_turno DROP COLUMN IF EXISTS cliente_id;
-- ALTER TABLE public.libro_turno DROP COLUMN IF EXISTS hash_novedades;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS pin_hash;
