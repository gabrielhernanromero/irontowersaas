-- MIGRACIÓN: Tarifas de turno (cálculo de $ estimado, opcional)
-- tecnico_id NULL = tarifa base (aplica a todos); tecnico_id NOT NULL =
-- override puntual para ese técnico. Si no se carga ninguna fila, el
-- módulo de horas trabajadas sigue funcionando (solo sin columna de $).

CREATE TABLE public.tarifas_turno (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id  uuid REFERENCES public.users(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('diurno', 'nocturno', 'feriado_nacional', 'feriado_puente')),
  valor       numeric(10,2) NOT NULL CHECK (valor >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Una sola tarifa base por tipo, y un solo override por técnico+tipo
CREATE UNIQUE INDEX idx_tarifa_base     ON public.tarifas_turno (tipo) WHERE tecnico_id IS NULL;
CREATE UNIQUE INDEX idx_tarifa_override ON public.tarifas_turno (tecnico_id, tipo) WHERE tecnico_id IS NOT NULL;

ALTER TABLE public.tarifas_turno ENABLE ROW LEVEL SECURITY;

-- Solo admin ve y edita tarifas: es sueldo real, más sensible que el conteo
-- de turnos (que sí ven supervisor+admin). En otro cliente del SaaS un
-- supervisor puede ser personal contratado que no debería ver esto.
CREATE POLICY "tarifas_select" ON public.tarifas_turno
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

CREATE POLICY "tarifas_insert" ON public.tarifas_turno
  FOR INSERT WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

CREATE POLICY "tarifas_update" ON public.tarifas_turno
  FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

CREATE POLICY "tarifas_delete" ON public.tarifas_turno
  FOR DELETE USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

-- ROLLBACK
-- DROP INDEX IF EXISTS idx_tarifa_override;
-- DROP INDEX IF EXISTS idx_tarifa_base;
-- DROP TABLE IF EXISTS public.tarifas_turno;
