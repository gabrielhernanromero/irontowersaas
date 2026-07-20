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
-- MIGRACIÓN: Rol habitual del técnico en su puesto
-- Permite al supervisor saber si el técnico es habitualmente encargado o apoyo.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS rol_habitual text
    CHECK (rol_habitual IN ('encargado', 'apoyo'));

-- Actualizar seed de prueba si existe
UPDATE public.users SET rol_habitual = 'encargado'
  WHERE id IN (
    'b0000001-0000-0000-0000-000000000001',
    'b0000003-0000-0000-0000-000000000003'
  );
UPDATE public.users SET rol_habitual = 'apoyo'
  WHERE id IN (
    'b0000002-0000-0000-0000-000000000002',
    'b0000004-0000-0000-0000-000000000004'
  );

-- ROLLBACK
-- ALTER TABLE public.users DROP COLUMN IF EXISTS rol_habitual;
-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: Modelo de Cobertura con Esquemas Dinámicos
--   • esquemas_cobertura   → plantillas de turnos por cliente (reemplaza enum diurno/nocturno)
--   • asignaciones_persistentes → asignación permanente (La Regla, ~80% de los días)
--   • asignaciones_turno   → excepción diaria (La Excepción, ausentismo/reemplazos)
--   • libro_turno           → agrega FK opcional a esquema_id
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. esquemas_cobertura ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esquemas_cobertura (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid    NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre      text    NOT NULL,
  hora_inicio time    NOT NULL,
  hora_fin    time    NOT NULL,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT esquema_horario_valido CHECK (hora_inicio <> hora_fin)
);

CREATE INDEX IF NOT EXISTS idx_esquemas_cobertura_cliente ON esquemas_cobertura(cliente_id);

-- ── 2. asignaciones_persistentes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asignaciones_persistentes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esquema_id  uuid NOT NULL REFERENCES esquemas_cobertura(id) ON DELETE CASCADE,
  usuario_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rol_turno   text NOT NULL CHECK (rol_turno IN ('encargado', 'apoyo')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (esquema_id, usuario_id)
);

-- Solo un encargado permanente por esquema
CREATE UNIQUE INDEX IF NOT EXISTS ap_one_encargado
  ON asignaciones_persistentes(esquema_id)
  WHERE rol_turno = 'encargado';

-- ── 3. asignaciones_turno (clean slate) ───────────────────────────────────────
-- Se elimina la versión anterior (usaba enum turno + cliente_id).
-- La nueva referencia directamente al esquema_cobertura.
DROP TABLE IF EXISTS asignaciones_turno CASCADE;

CREATE TABLE asignaciones_turno (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esquema_id  uuid NOT NULL REFERENCES esquemas_cobertura(id) ON DELETE CASCADE,
  usuario_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rol_turno   text NOT NULL CHECK (rol_turno IN ('encargado', 'apoyo')),
  fecha       date NOT NULL,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (esquema_id, usuario_id, fecha)
);

-- Solo un encargado de excepción por esquema/fecha
CREATE UNIQUE INDEX at_one_encargado
  ON asignaciones_turno(esquema_id, fecha)
  WHERE rol_turno = 'encargado';

-- ── 4. libro_turno: agregar FK al esquema ────────────────────────────────────
ALTER TABLE libro_turno
  ADD COLUMN IF NOT EXISTS esquema_id uuid REFERENCES esquemas_cobertura(id);

-- ── 5. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE esquemas_cobertura        ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_persistentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_turno        ENABLE ROW LEVEL SECURITY;

-- esquemas_cobertura
CREATE POLICY "supervisors_manage_esquemas"
  ON esquemas_cobertura FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'rol') IN ('supervisor', 'admin'))
  WITH CHECK ((auth.jwt() ->> 'rol') IN ('supervisor', 'admin'));

CREATE POLICY "tecnicos_read_esquemas"
  ON esquemas_cobertura FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'rol') = 'tecnico'
    AND cliente_id IN (
      SELECT cliente_id FROM users WHERE id = auth.uid() AND cliente_id IS NOT NULL
    )
  );

-- asignaciones_persistentes
CREATE POLICY "supervisors_manage_persistentes"
  ON asignaciones_persistentes FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'rol') IN ('supervisor', 'admin'))
  WITH CHECK ((auth.jwt() ->> 'rol') IN ('supervisor', 'admin'));

CREATE POLICY "tecnicos_read_persistentes"
  ON asignaciones_persistentes FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'rol') = 'tecnico'
    AND usuario_id = auth.uid()
  );

-- asignaciones_turno
CREATE POLICY "supervisors_manage_asignaciones"
  ON asignaciones_turno FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'rol') IN ('supervisor', 'admin'))
  WITH CHECK ((auth.jwt() ->> 'rol') IN ('supervisor', 'admin'));

CREATE POLICY "tecnicos_read_asignaciones"
  ON asignaciones_turno FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'rol') = 'tecnico'
    AND usuario_id = auth.uid()
  );
