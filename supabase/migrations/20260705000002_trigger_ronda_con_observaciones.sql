-- Actualiza el trigger de ronda completada para incluir observaciones de scans
-- en la descripción del libro_novedad.

CREATE OR REPLACE FUNCTION fn_novedad_ronda_completada()
RETURNS TRIGGER AS $$
DECLARE
  duracion_min int;
  duracion_str text;
  obs_str      text;
BEGIN
  IF NEW.completa = true
     AND (OLD.completa IS DISTINCT FROM true)
     AND NEW.turno_id IS NOT NULL
  THEN
    BEGIN
      IF NEW.hora_inicio IS NOT NULL THEN
        duracion_min := ROUND(EXTRACT(EPOCH FROM (NOW() - NEW.hora_inicio)) / 60)::int;
        IF duracion_min >= 60 THEN
          duracion_str := (duracion_min / 60)::text || 'h ' || (duracion_min % 60)::text || ' min';
        ELSE
          duracion_str := duracion_min::text || ' min';
        END IF;
      ELSE
        duracion_str := '—';
      END IF;

      -- Recolectar observaciones de los scans de esta ronda
      SELECT string_agg(pc.nombre || ': ' || rs.observacion, ' · ' ORDER BY rs.orden_real)
      INTO obs_str
      FROM public.ronda_scans rs
      JOIN public.puntos_control pc ON pc.id = rs.punto_control_id
      WHERE rs.ronda_id = NEW.id
        AND rs.observacion IS NOT NULL
        AND trim(rs.observacion) <> '';

      INSERT INTO public.libro_novedad (turno_id, tecnico_id, tipo, hora, descripcion)
      VALUES (
        NEW.turno_id,
        NEW.tecnico_id,
        'ronda',
        (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::time,
        'Ronda #' || NEW.numero_ronda
          || ' completada — '
          || COALESCE(NEW.puntos_escaneados::text, '?') || '/' || COALESCE(NEW.total_puntos::text, '?') || ' puntos · '
          || COALESCE(TO_CHAR(NEW.hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI'), '—')
          || ' → '
          || TO_CHAR(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')
          || ' (' || duracion_str || ')'
          || CASE WHEN obs_str IS NOT NULL
               THEN ' — Novedades: ' || obs_str
               ELSE ''
             END
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_novedad_ronda_completada falló: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
