-- Agrega días de la semana a esquemas_cobertura
-- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
ALTER TABLE public.esquemas_cobertura
  ADD COLUMN IF NOT EXISTS dias_semana integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';
