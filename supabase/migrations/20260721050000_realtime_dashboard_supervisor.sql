-- Habilita Supabase Realtime para las tablas que el dashboard del supervisor
-- escucha en vivo (libro_novedad, libro_turno, incidencias). Solo "alertas"
-- tenía esto habilitado — el resto de los canales de DashboardClient.tsx
-- nunca recibían eventos aunque el código de suscripción era correcto.
ALTER PUBLICATION supabase_realtime ADD TABLE libro_novedad;
ALTER PUBLICATION supabase_realtime ADD TABLE libro_turno;
ALTER PUBLICATION supabase_realtime ADD TABLE incidencias;
