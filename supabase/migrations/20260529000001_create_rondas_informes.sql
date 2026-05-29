-- ═══════════════════════════════════════════════════════════════
-- Módulo Rondas + Informes
-- ═══════════════════════════════════════════════════════════════

-- ── Puntos de control (checkpoints por cliente) ──────────────
CREATE TABLE IF NOT EXISTS public.puntos_control (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL,
  descripcion TEXT,
  ubicacion   TEXT,
  codigo_qr   TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  orden       INTEGER     NOT NULL DEFAULT 0,
  activo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Rondas (una vuelta completa al predio) ───────────────────
CREATE TABLE IF NOT EXISTS public.rondas (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id          UUID        REFERENCES public.libro_turno(id),
  tecnico_id        UUID        NOT NULL REFERENCES public.users(id),
  cliente_id        UUID        NOT NULL REFERENCES public.clientes(id),
  numero_ronda      INTEGER     NOT NULL DEFAULT 1,
  hora_inicio       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_fin          TIMESTAMPTZ,
  total_puntos      INTEGER     NOT NULL DEFAULT 0,
  puntos_escaneados INTEGER     NOT NULL DEFAULT 0,
  completa          BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Scans individuales de cada checkpoint ────────────────────
CREATE TABLE IF NOT EXISTS public.ronda_scans (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ronda_id         UUID        NOT NULL REFERENCES public.rondas(id) ON DELETE CASCADE,
  punto_control_id UUID        NOT NULL REFERENCES public.puntos_control(id),
  escaneado_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  foto_url         TEXT,
  latitud          DECIMAL(10,8),
  longitud         DECIMAL(11,8),
  orden_real       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ronda_id, punto_control_id)
);

-- ── Informes generados ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.informes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT        NOT NULL UNIQUE,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('turno','incidencia','ejecutivo','vida_incidencia')),
  cliente_id      UUID        REFERENCES public.clientes(id),
  supervisor_id   UUID        REFERENCES public.users(id),
  estado          TEXT        NOT NULL DEFAULT 'borrador'
                              CHECK (estado IN ('borrador','generando','listo','enviado')),
  version         INTEGER     NOT NULL DEFAULT 1,
  turno_ids       UUID[],
  incidencia_ids  UUID[],
  fecha_desde     DATE,
  fecha_hasta     DATE,
  incluir_fotos   BOOLEAN     NOT NULL DEFAULT false,
  incluir_rondas  BOOLEAN     NOT NULL DEFAULT false,
  contenido_ai    TEXT,
  contenido       TEXT,
  hash_contenido  TEXT,
  pdf_url         TEXT,
  enviado_at      TIMESTAMPTZ,
  enviado_a       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.puntos_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rondas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ronda_scans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informes       ENABLE ROW LEVEL SECURITY;

-- puntos_control: supervisores gestionan, técnicos leen
CREATE POLICY "supervisores_puntos_control_all"
  ON public.puntos_control FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND rol IN ('supervisor','admin')));

CREATE POLICY "tecnicos_puntos_control_read"
  ON public.puntos_control FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND rol = 'tecnico'));

-- rondas: supervisores ven todas, técnicos solo las propias
CREATE POLICY "supervisores_rondas_all"
  ON public.rondas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND rol IN ('supervisor','admin')));

CREATE POLICY "tecnicos_rondas_own"
  ON public.rondas FOR ALL TO authenticated
  USING  (tecnico_id = auth.uid())
  WITH CHECK (tecnico_id = auth.uid());

-- ronda_scans: supervisores ven todas, técnicos solo las de sus rondas
CREATE POLICY "supervisores_scans_all"
  ON public.ronda_scans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND rol IN ('supervisor','admin')));

CREATE POLICY "tecnicos_scans_own"
  ON public.ronda_scans FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rondas r
    WHERE r.id = ronda_id AND r.tecnico_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rondas r
    WHERE r.id = ronda_id AND r.tecnico_id = auth.uid()
  ));

-- informes: solo supervisores
CREATE POLICY "supervisores_informes_all"
  ON public.informes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND rol IN ('supervisor','admin')));

-- ── ROLLBACK ─────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.informes;
-- DROP TABLE IF EXISTS public.ronda_scans;
-- DROP TABLE IF EXISTS public.rondas;
-- DROP TABLE IF EXISTS public.puntos_control;
