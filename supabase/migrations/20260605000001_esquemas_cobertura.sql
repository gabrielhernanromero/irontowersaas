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
