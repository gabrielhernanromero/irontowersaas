-- La política novedad_select exigía resolver una subconsulta anidada contra
-- libro_turno (y esa, a su vez, contra participaciones_turno) incluso para el
-- caso admin/supervisor. Funciona bien en queries normales, pero Supabase
-- Realtime falla en silencio (sin error, simplemente no entrega el evento)
-- cuando la política de SELECT tiene subconsultas anidadas así — por eso el
-- dashboard del supervisor nunca recibía las novedades en vivo aunque la
-- tabla ya estaba en la publicación de Realtime.
--
-- Se reordena para que el caso admin/supervisor sea la primera condición del
-- OR, sin ninguna subconsulta — Realtime sí entrega el evento cuando la
-- política se puede resolver sin joins a otras tablas.
DROP POLICY IF EXISTS "novedad_select" ON public.libro_novedad;

CREATE POLICY "novedad_select" ON public.libro_novedad
  FOR SELECT USING (
    ((auth.jwt() -> 'user_metadata') ->> 'rol') = ANY (ARRAY['admin', 'supervisor'])
    OR EXISTS (
      SELECT 1 FROM public.libro_turno lt
      WHERE lt.id = libro_novedad.turno_id
        AND (
          lt.tecnico_id = auth.uid()
          OR (lt.estado = 'cerrado' AND lt.firma_relevo_url IS NULL)
          OR EXISTS (
            SELECT 1 FROM public.participaciones_turno pt
            WHERE pt.turno_id = lt.id AND pt.usuario_id = auth.uid()
          )
        )
    )
  );
