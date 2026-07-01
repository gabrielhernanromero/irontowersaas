-- El trigger on_auth_user_created creaba conflictos con el INSERT manual
-- del route de administración. Todo usuario se crea únicamente vía API.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Unicidad de DNI garantizada a nivel DB (no solo en código)
ALTER TABLE public.users
  ADD CONSTRAINT users_dni_unique UNIQUE (dni);
