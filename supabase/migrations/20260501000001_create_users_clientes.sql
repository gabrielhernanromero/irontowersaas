-- MIGRACIÓN 1: Tabla de usuarios y clientes

-- Perfil de usuario (extiende auth.users de Supabase)
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nombre     text not null,
  apellido   text not null,
  rol        text not null check (rol in ('admin', 'supervisor', 'tecnico', 'cliente')),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Usar auth.jwt() para evitar recursión infinita en RLS
create policy "users_select" on public.users
  for select using (
    auth.uid() = id
    or (auth.jwt() -> 'user_metadata' ->> 'rol') in ('admin', 'supervisor')
  );

create policy "users_insert" on public.users
  for insert with check (auth.uid() = id);

create policy "users_update" on public.users
  for update using (
    auth.uid() = id
    or (auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin'
  );

-- Trigger para crear el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, nombre, apellido, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    coalesce(new.raw_user_meta_data->>'rol', 'tecnico')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Tabla de clientes (empresas contratantes)
create table public.clientes (
  id                 uuid primary key default gen_random_uuid(),
  nombre_empresa     text not null,
  cuit               text not null,
  direccion          text not null,
  contacto_nombre    text not null,
  contacto_email     text not null,
  contacto_telefono  text not null,
  created_at         timestamptz not null default now()
);

alter table public.clientes enable row level security;

create policy "clientes_select" on public.clientes
  for select using (
    (auth.jwt() -> 'user_metadata' ->> 'rol') in ('admin', 'supervisor', 'tecnico')
  );

create policy "clientes_insert" on public.clientes
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'rol') in ('admin', 'supervisor')
  );

create policy "clientes_update" on public.clientes
  for update using (
    (auth.jwt() -> 'user_metadata' ->> 'rol') in ('admin', 'supervisor')
  );

-- ROLLBACK
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user();
-- drop table if exists public.clientes;
-- drop table if exists public.users;
