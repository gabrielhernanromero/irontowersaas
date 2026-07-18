-- Trigger que crea la novedad en libro_novedad cuando una ronda se completa
-- Más confiable que hacerlo desde la API: es atómico con el UPDATE de la ronda.

CREATE OR REPLACE FUNCTION fn_novedad_ronda_completada()
RETURNS TRIGGER AS $$
DECLARE
  duracion_min int;
  duracion_str text;
BEGIN
  -- Dispara solo en la transición false→true de "completa", con turno_id presente
  IF NEW.completa = true
     AND (OLD.completa IS DISTINCT FROM true)
     AND NEW.turno_id IS NOT NULL
  THEN
    duracion_min := ROUND(EXTRACT(EPOCH FROM (NOW() - NEW.hora_inicio)) / 60)::int;

    IF duracion_min >= 60 THEN
      duracion_str := (duracion_min / 60)::text || 'h ' || (duracion_min % 60)::text || ' min';
    ELSE
      duracion_str := duracion_min::text || ' min';
    END IF;

    BEGIN
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
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_novedad_ronda_completada falló: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_novedad_ronda_completada
AFTER UPDATE ON public.rondas
FOR EACH ROW
EXECUTE FUNCTION fn_novedad_ronda_completada();
