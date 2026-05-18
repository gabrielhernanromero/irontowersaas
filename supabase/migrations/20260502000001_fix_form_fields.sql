-- MIGRACIÓN: Observaciones por campo + aclaración de firma + cliente de prueba

-- Reemplazar observaciones genérica por columnas por campo en hidrantes
ALTER TABLE public.planilla_hidrantes
  DROP COLUMN IF EXISTS observaciones,
  ADD COLUMN obs_gabinete text,
  ADD COLUMN obs_manga    text,
  ADD COLUMN obs_lanza    text,
  ADD COLUMN obs_valvula  text;

-- Reemplazar observaciones genérica por columnas por campo en extintores
ALTER TABLE public.planilla_extintores
  DROP COLUMN IF EXISTS observaciones,
  ADD COLUMN obs_senalizacion text,
  ADD COLUMN obs_acceso       text,
  ADD COLUMN obs_presion_peso text;

-- Aclaración de firma (nombre y apellido impreso) en planillas
ALTER TABLE public.planillas
  ADD COLUMN IF NOT EXISTS firma_aclaracion text;

-- Cliente de prueba
INSERT INTO public.clientes (nombre_empresa, cuit, direccion, contacto_nombre, contacto_email, contacto_telefono)
VALUES ('YPF S.A.', '30-54668997-9', 'Av. Presidente Roque Sáenz Peña 777, CABA', 'Carlos Méndez', 'cmendez@ypf.com', '011-4329-2000')
ON CONFLICT DO NOTHING;

-- ROLLBACK
-- ALTER TABLE public.planilla_hidrantes ADD COLUMN observaciones text, DROP COLUMN obs_gabinete, DROP COLUMN obs_manga, DROP COLUMN obs_lanza, DROP COLUMN obs_valvula;
-- ALTER TABLE public.planilla_extintores ADD COLUMN observaciones text, DROP COLUMN obs_senalizacion, DROP COLUMN obs_acceso, DROP COLUMN obs_presion_peso;
-- ALTER TABLE public.planillas DROP COLUMN IF EXISTS firma_aclaracion;
-- DELETE FROM public.clientes WHERE cuit = '30-54668997-9';
