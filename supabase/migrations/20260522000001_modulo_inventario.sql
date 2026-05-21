-- MIGRACIÓN: Módulo de Gestión de Activos e Inventario de Puesto

-- ─── 1. Tabla de elementos asignados al puesto ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.elementos_puesto (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id                  uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre                      text        NOT NULL,
  codigo_patrimonial          text        NOT NULL,
  categoria                   text,
  descripcion                 text,
  estado_admin                text        NOT NULL DEFAULT 'activo'
                                          CHECK (estado_admin IN ('activo', 'en_mantenimiento', 'inactivo')),
  fecha_retiro_mantenimiento  date,
  motivo_mantenimiento        text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.elementos_puesto ENABLE ROW LEVEL SECURITY;

-- Técnicos ven elementos del cliente al que están asignados; supervisores/admins ven todo
CREATE POLICY "elementos_select" ON public.elementos_puesto
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.cliente_id = cliente_id OR u.rol IN ('admin', 'supervisor'))
    )
  );

-- Solo admin/supervisor gestionan el catálogo (alta, baja, mantenimiento)
CREATE POLICY "elementos_insert" ON public.elementos_puesto
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

CREATE POLICY "elementos_update" ON public.elementos_puesto
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- ─── 2. Tabla de control de inventario por turno ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.control_inventario_turno (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id          uuid        NOT NULL REFERENCES public.libro_turno(id)    ON DELETE CASCADE,
  elemento_id       uuid        NOT NULL REFERENCES public.elementos_puesto(id) ON DELETE CASCADE,
  estado_operativo  text        NOT NULL CHECK (estado_operativo IN ('ok', 'falla', 'faltante')),
  observacion       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(turno_id, elemento_id)   -- un solo registro por elemento por turno
);

ALTER TABLE public.control_inventario_turno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "control_select" ON public.control_inventario_turno
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.libro_turno lt
      WHERE lt.id = turno_id
        AND (
          lt.tecnico_id = auth.uid()
          OR (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
        )
    )
  );
-- INSERT solo vía supabaseAdmin() — la validación ocurre en el Route Handler

-- ─── 3. Extender incidencias con trazabilidad de activos ─────────────────────
ALTER TABLE public.incidencias
  ADD COLUMN IF NOT EXISTS elemento_afectado_id uuid REFERENCES public.elementos_puesto(id),
  ADD COLUMN IF NOT EXISTS tecnico_detector_id  uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS tecnico_imputado_id  uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS turno_imputado_id    uuid REFERENCES public.libro_turno(id);

-- ─── 4. Agregar tipo 'alerta' a libro_novedad ────────────────────────────────
-- Buscar y eliminar el CHECK constraint existente (auto-nombrado por PostgreSQL)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT c.conname INTO cname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'libro_novedad'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%tipo%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.libro_novedad DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.libro_novedad
  ADD CONSTRAINT libro_novedad_tipo_check
  CHECK (tipo IN ('apertura', 'novedad', 'cierre', 'alerta'));

-- ─── 5. Índices ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_elementos_cliente ON public.elementos_puesto (cliente_id, estado_admin);
CREATE INDEX IF NOT EXISTS idx_control_turno     ON public.control_inventario_turno (turno_id);
CREATE INDEX IF NOT EXISTS idx_control_elemento  ON public.control_inventario_turno (elemento_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_elem  ON public.incidencias (elemento_afectado_id)
  WHERE elemento_afectado_id IS NOT NULL;

-- ─── ROLLBACK ────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_incidencias_elem;
-- DROP INDEX IF EXISTS idx_control_elemento;
-- DROP INDEX IF EXISTS idx_control_turno;
-- DROP INDEX IF EXISTS idx_elementos_cliente;
-- ALTER TABLE public.libro_novedad DROP CONSTRAINT IF EXISTS libro_novedad_tipo_check;
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS turno_imputado_id;
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS tecnico_imputado_id;
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS tecnico_detector_id;
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS elemento_afectado_id;
-- DROP TABLE IF EXISTS public.control_inventario_turno;
-- DROP TABLE IF EXISTS public.elementos_puesto;
