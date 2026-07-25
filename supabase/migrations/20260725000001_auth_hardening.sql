-- MIGRACIÓN: Autenticación profesional
-- Contraseña temporal obligatoria a cambiar, bloqueo por fuerza bruta, auditoría de accesos

alter table public.users
  add column must_change_password  boolean not null default false,
  add column failed_login_attempts int not null default 0,
  add column locked_until          timestamptz,
  add column last_login_at         timestamptz;

create table public.auth_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  email       text not null,
  evento      text not null check (evento in (
    'login_ok',
    'login_fail',
    'account_locked',
    'account_unlocked',
    'password_reset_admin',
    'password_change_self',
    'usuario_creado',
    'usuario_desactivado'
  )),
  actor_id    uuid references public.users(id) on delete set null,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

alter table public.auth_events enable row level security;

-- Solo admin/supervisor pueden ver el registro de auditoría
create policy "auth_events_select" on public.auth_events
  for select using (
    (auth.jwt() -> 'user_metadata' ->> 'rol') in ('admin', 'supervisor')
  );

-- Los inserts se hacen exclusivamente desde route handlers vía service role
-- (supabaseAdmin), que bypasea RLS — no hace falta policy de insert.

create index auth_events_user_id_idx on public.auth_events(user_id);
create index auth_events_created_at_idx on public.auth_events(created_at desc);

-- ROLLBACK
-- drop table if exists public.auth_events;
-- alter table public.users
--   drop column must_change_password,
--   drop column failed_login_attempts,
--   drop column locked_until,
--   drop column last_login_at;
