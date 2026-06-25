-- Habilita Supabase Realtime para la tabla alertas.
-- Necesario para que los badges de notificación se actualicen sin recargar.
ALTER PUBLICATION supabase_realtime ADD TABLE alertas;
