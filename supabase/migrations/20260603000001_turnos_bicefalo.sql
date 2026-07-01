-- MIGRACIÓN: Modelo de Turnos Bicéfalo (encargado + apoyo)
-- Permite que el supervisor asigne 2 técnicos por turno antes de que comience.
-- El encargado abre/cierra el libro_turno; el apoyo se une automáticamente.

-- ─── 1. Tabla de pre-asignaciones (supervisor asigna ANTES del turno) ───────────
CREATE TABLE IF NOT EXISTS public.asignaciones_turno (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid        NOT NULL REFERENCES public.clientes(id)  ON DELETE CASCADE,
  usuario_id  uuid        NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  rol_turno   text        NOT NULL CHECK (rol_turno IN ('encargado', 'apoyo')),
  fecha       date        NOT NULL,
  turno       text        NOT NULL CHECK (turno IN ('diurno', 'nocturno')),
  created_by  uuid        NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Un técnico no puede tener dos roles en el mismo turno/objetivo/fecha
  UNIQUE (cliente_id, fecha, turno, usuario_id)
);

ALTER TABLE public.asignaciones_turno ENABLE ROW LEVEL SECURITY;

-- Supervisor/admin gestionan todas las asignaciones
CREATE POLICY "asignaciones_select" ON public.asignaciones_turno
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

CREATE POLICY "asignaciones_insert" ON public.asignaciones_turno
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

CREATE POLICY "asignaciones_update" ON public.asignaciones_turno
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

CREATE POLICY "asignaciones_delete" ON public.asignaciones_turno
  FOR DELETE USING (
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- ─── 2. Tabla de participaciones activas (apoyo se une al turno abierto) ────────
CREATE TABLE IF NOT EXISTS public.participaciones_turno (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id    uuid        NOT NULL REFERENCES public.libro_turno(id) ON DELETE CASCADE,
  usuario_id  uuid        NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  -- Solo 'apoyo' va aquí; el encargado ya figura como tecnico_id en libro_turno
  rol_turno   text        NOT NULL DEFAULT 'apoyo' CHECK (rol_turno = 'apoyo'),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turno_id, usuario_id)
);

ALTER TABLE public.participaciones_turno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participaciones_select" ON public.participaciones_turno
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.libro_turno lt
      WHERE lt.id = turno_id AND lt.tecnico_id = auth.uid()
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- INSERT solo vía supabaseAdmin() — la API /join valida la asignación previa
-- UPDATE/DELETE: ninguno — el vínculo es permanente dentro del turno

-- ─── 3. Ampliar incidencias con flujo de aprobación del encargado ────────────────
ALTER TABLE public.incidencias
  ADD COLUMN IF NOT EXISTS requiere_aprobacion boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estado_aprobacion   text        NOT NULL DEFAULT 'aprobada'
    CHECK (estado_aprobacion IN ('pendiente_revision', 'aprobada', 'rechazada')),
  ADD COLUMN IF NOT EXISTS aprobada_por        uuid        REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS aprobada_at         timestamptz;

-- Backfill: incidencias existentes quedan aprobadas (creadas por encargado)
UPDATE public.incidencias
  SET requiere_aprobacion = false,
      estado_aprobacion   = 'aprobada'
  WHERE estado_aprobacion = 'aprobada'; -- ya están en default, explícito por claridad

-- ─── 4. RLS: encargado puede aprobar/rechazar incidencias de su turno ─────────────
-- Reemplazar política de UPDATE en incidencias (agrega encargado)
DROP POLICY IF EXISTS "incidencias_update" ON public.incidencias;

CREATE POLICY "incidencias_update" ON public.incidencias
  FOR UPDATE USING (
    -- Admin/supervisor pueden resolver cualquier incidencia
    (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
    -- Encargado puede aprobar/rechazar incidencias del turno que tiene abierto
    OR EXISTS (
      SELECT 1 FROM public.libro_turno lt
      WHERE lt.id = turno_creacion_id
        AND lt.tecnico_id = auth.uid()
    )
  );

-- ─── 5. RLS libro_turno: apoyo puede ver el turno activo en el que participa ─────
DROP POLICY IF EXISTS "turno_select" ON public.libro_turno;

CREATE POLICY "turno_select" ON public.libro_turno
  FOR SELECT USING (
    tecnico_id = auth.uid()
    -- Cualquier técnico puede ver turnos cerrados sin relevo (para firmar)
    OR (estado = 'cerrado' AND firma_relevo_url IS NULL)
    -- Apoyo ve el turno en el que está participando
    OR EXISTS (
      SELECT 1 FROM public.participaciones_turno pt
      WHERE pt.turno_id = id AND pt.usuario_id = auth.uid()
    )
    -- Supervisores y admins ven todo
    OR (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
  );

-- ─── 6. RLS libro_novedad: apoyo puede insertar novedades en turno activo ─────────
DROP POLICY IF EXISTS "novedad_insert" ON public.libro_novedad;

CREATE POLICY "novedad_insert" ON public.libro_novedad
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.libro_turno lt
      WHERE lt.id = turno_id
        AND lt.estado = 'abierto'
        AND (
          -- Encargado
          lt.tecnico_id = auth.uid()
          -- Apoyo participando en el turno
          OR EXISTS (
            SELECT 1 FROM public.participaciones_turno pt
            WHERE pt.turno_id = lt.id AND pt.usuario_id = auth.uid()
          )
        )
    )
  );

-- También actualizar SELECT de libro_novedad para que el apoyo vea las novedades
DROP POLICY IF EXISTS "novedad_select" ON public.libro_novedad;

CREATE POLICY "novedad_select" ON public.libro_novedad
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.libro_turno lt
      WHERE lt.id = turno_id
        AND (
          lt.tecnico_id = auth.uid()
          OR (lt.estado = 'cerrado' AND lt.firma_relevo_url IS NULL)
          OR EXISTS (
            SELECT 1 FROM public.participaciones_turno pt
            WHERE pt.turno_id = lt.id AND pt.usuario_id = auth.uid()
          )
          OR (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor')
        )
    )
  );

-- ─── 7. Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_asignaciones_cliente_fecha
  ON public.asignaciones_turno (cliente_id, fecha, turno);

CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario
  ON public.asignaciones_turno (usuario_id, fecha);

CREATE INDEX IF NOT EXISTS idx_participaciones_turno
  ON public.participaciones_turno (turno_id);

CREATE INDEX IF NOT EXISTS idx_participaciones_usuario
  ON public.participaciones_turno (usuario_id);

CREATE INDEX IF NOT EXISTS idx_incidencias_aprobacion
  ON public.incidencias (estado_aprobacion, turno_creacion_id)
  WHERE requiere_aprobacion = true;

-- ─── ROLLBACK ────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_incidencias_aprobacion;
-- DROP INDEX IF EXISTS idx_participaciones_usuario;
-- DROP INDEX IF EXISTS idx_participaciones_turno;
-- DROP INDEX IF EXISTS idx_asignaciones_usuario;
-- DROP INDEX IF EXISTS idx_asignaciones_cliente_fecha;
-- (Restaurar políticas originales de turno_select, novedad_select, novedad_insert, incidencias_update)
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS aprobada_at;
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS aprobada_por;
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS estado_aprobacion;
-- ALTER TABLE public.incidencias DROP COLUMN IF EXISTS requiere_aprobacion;
-- DROP TABLE IF EXISTS public.participaciones_turno;
-- DROP TABLE IF EXISTS public.asignaciones_turno;
