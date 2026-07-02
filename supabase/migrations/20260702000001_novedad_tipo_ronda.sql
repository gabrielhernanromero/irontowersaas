-- Agregar tipo 'ronda' a libro_novedad para registrar rondas completadas
ALTER TABLE public.libro_novedad DROP CONSTRAINT IF EXISTS libro_novedad_tipo_check;
ALTER TABLE public.libro_novedad ADD CONSTRAINT libro_novedad_tipo_check CHECK (
  tipo IN ('apertura', 'novedad', 'cierre', 'alerta', 'sistema', 'ronda')
);

-- ROLLBACK:
-- ALTER TABLE public.libro_novedad DROP CONSTRAINT IF EXISTS libro_novedad_tipo_check;
-- ALTER TABLE public.libro_novedad ADD CONSTRAINT libro_novedad_tipo_check CHECK (
--   tipo IN ('apertura', 'novedad', 'cierre', 'alerta', 'sistema')
-- );
