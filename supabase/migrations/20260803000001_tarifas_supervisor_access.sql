-- MIGRACIÓN: Amplía el acceso a tarifas_turno de admin-only a supervisor+admin
--
-- Contexto: en Iron Tower hoy los "supervisores" de la app son directamente
-- los dueños (Mariano, Nahuel) — restringir la configuración de tarifas a
-- admin les impedía configurar sus propias tarifas de turno. Se iguala al
-- resto del módulo de Personal (mismo criterio que /supervisor/personal/horas).
--
-- Si en el futuro hay un cliente del SaaS con un supervisor contratado que
-- no sea dueño, revisar esto de nuevo — es sueldo real, más sensible que el
-- conteo de turnos.

DROP POLICY IF EXISTS "tarifas_select" ON public.tarifas_turno;
DROP POLICY IF EXISTS "tarifas_insert" ON public.tarifas_turno;
DROP POLICY IF EXISTS "tarifas_update" ON public.tarifas_turno;
DROP POLICY IF EXISTS "tarifas_delete" ON public.tarifas_turno;

CREATE POLICY "tarifas_select" ON public.tarifas_turno
  FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor'));

CREATE POLICY "tarifas_insert" ON public.tarifas_turno
  FOR INSERT WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor'));

CREATE POLICY "tarifas_update" ON public.tarifas_turno
  FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor'));

CREATE POLICY "tarifas_delete" ON public.tarifas_turno
  FOR DELETE USING ((auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'supervisor'));

-- ROLLBACK
-- DROP POLICY IF EXISTS "tarifas_select" ON public.tarifas_turno;
-- DROP POLICY IF EXISTS "tarifas_insert" ON public.tarifas_turno;
-- DROP POLICY IF EXISTS "tarifas_update" ON public.tarifas_turno;
-- DROP POLICY IF EXISTS "tarifas_delete" ON public.tarifas_turno;
-- CREATE POLICY "tarifas_select" ON public.tarifas_turno FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');
-- CREATE POLICY "tarifas_insert" ON public.tarifas_turno FOR INSERT WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');
-- CREATE POLICY "tarifas_update" ON public.tarifas_turno FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');
-- CREATE POLICY "tarifas_delete" ON public.tarifas_turno FOR DELETE USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');
