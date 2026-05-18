-- MIGRACIÓN: Libro de guardia rediseñado — libro_turno + libro_novedad

-- DNI en usuarios (obligatorio para el libro de guardia)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dni text;

-- Secuencia de folio correlativo
CREATE SEQUENCE IF NOT EXISTS libro_turno_folio_seq START 1;

-- ─── libro_turno: un registro por turno ───────────────────────────────────────
CREATE TABLE public.libro_turno (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_numero        integer NOT NULL DEFAULT nextval('libro_turno_folio_seq'),
  fecha               date NOT NULL,
  turno               text NOT NULL CHECK (turno IN ('diurno', 'nocturno')),
  tecnico_id          uuid NOT NULL REFERENCES public.users(id),
  tecnico_nombre      text NOT NULL,
  tecnico_dni         text NOT NULL,
  horario_inicio      time NOT NULL,
  horario_fin         time,
  estado              text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  -- Firma del técnico al cerrar su guardia (personal saliente)
  firma_cierre_url    text,
  -- Firma del técnico entrante confirmando recepción del turno
  firma_relevo_url    text,
  relevo_nombre       text,
  relevo_dni          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.libro_turno ENABLE ROW LEVEL SECURITY;

-- El técnico ve sus propios turnos
-- Cualquier técnico puede ver turnos CERRADOS sin relevo (para poder firmar el relevo)
-- Supervisores/admins ven todo
CREATE POLICY "turno_select" ON public.libro_turno
  FOR SELECT USING (
    tecnico_id = auth.uid()
    OR (estado = 'cerrado' AND firma_relevo_url IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.rol IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "turno_insert" ON public.libro_turno
  FOR INSERT WITH CHECK (tecnico_id = auth.uid());

-- UPDATE solo vía supabaseAdmin() (service role bypasea RLS)
-- Se usa para: cerrar turno, agregar firma_relevo
-- Sin política DELETE

-- ─── libro_novedad: múltiples por turno, inmutables ──────────────────────────
CREATE TABLE public.libro_novedad (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id              uuid NOT NULL REFERENCES public.libro_turno(id),
  tipo                  text NOT NULL CHECK (tipo IN ('apertura', 'novedad', 'cierre')),
  hora                  time NOT NULL,
  descripcion           text NOT NULL,
  riesgo_detectado      text,
  medidas_adoptadas     text,
  observaciones_generales text,
  foto_url              text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.libro_novedad ENABLE ROW LEVEL SECURITY;

-- Ver novedades de turnos propios o turnos cerrados sin relevo (misma lógica)
CREATE POLICY "novedad_select" ON public.libro_novedad
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.libro_turno lt
      WHERE lt.id = turno_id
        AND (
          lt.tecnico_id = auth.uid()
          OR (lt.estado = 'cerrado' AND lt.firma_relevo_url IS NULL)
          OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.rol IN ('admin', 'supervisor')
          )
        )
    )
  );

-- Solo INSERT desde el propio técnico del turno abierto
CREATE POLICY "novedad_insert" ON public.libro_novedad
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.libro_turno lt
      WHERE lt.id = turno_id
        AND lt.tecnico_id = auth.uid()
        AND lt.estado = 'abierto'
    )
  );

-- Sin UPDATE ni DELETE: las novedades son inmutables

-- Índices
CREATE INDEX libro_turno_tecnico ON public.libro_turno (tecnico_id, created_at DESC);
CREATE INDEX libro_turno_estado ON public.libro_turno (estado, fecha DESC);
CREATE INDEX libro_novedad_turno ON public.libro_novedad (turno_id, created_at ASC);

-- ROLLBACK
-- DROP INDEX IF EXISTS libro_novedad_turno;
-- DROP INDEX IF EXISTS libro_turno_estado;
-- DROP INDEX IF EXISTS libro_turno_tecnico;
-- DROP TABLE IF EXISTS public.libro_novedad;
-- DROP TABLE IF EXISTS public.libro_turno;
-- DROP SEQUENCE IF EXISTS libro_turno_folio_seq;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS dni;
