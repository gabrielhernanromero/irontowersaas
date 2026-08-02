-- GPS Fase 1 — ajuste legal: libro_turno no tenía ninguna RLS de UPDATE
-- (todos los UPDATE pasan por supabaseAdmin(), que bypassa RLS por completo).
-- Con las columnas de GPS ya sumadas, agregamos una barrera de defensa en
-- profundidad: un turno cerrado no debería poder modificarse, con la única
-- excepción de admin para correcciones manuales excepcionales (ni siquiera
-- supervisor). No cambia el comportamiento de los endpoints existentes
-- (usan service role), pero protege contra un UPDATE directo desde un
-- cliente autenticado normal.
CREATE POLICY "turno_update_no_final" ON public.libro_turno
  FOR UPDATE USING (
    estado <> 'cerrado'
    OR (auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin'
  );

-- ROLLBACK:
-- DROP POLICY IF EXISTS "turno_update_no_final" ON public.libro_turno;
