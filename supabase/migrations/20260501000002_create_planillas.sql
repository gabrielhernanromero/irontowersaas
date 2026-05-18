-- MIGRACIÓN 2: Planillas e ítems

-- Tabla principal de planillas
create table public.planillas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('hidrantes', 'extintores')),
  tecnico_id  uuid not null references public.users(id),
  cliente_id  uuid not null references public.clientes(id),
  fecha       date not null,
  turno       text not null check (turno in ('diurno', 'nocturno')),
  firma_url   text,
  enviada_at  timestamptz,
  inmutable   boolean not null default false,
  user_agent  text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.planillas enable row level security;

-- Técnicos ven solo SUS planillas; supervisores y admins ven todas
create policy "planillas_select" on public.planillas
  for select using (
    tecnico_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
    )
  );

create policy "planillas_insert" on public.planillas
  for insert with check (
    tecnico_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
    )
  );

-- REGLA 2: UPDATE solo permitido cuando inmutable = false
-- Una planilla enviada (inmutable=true) NO puede ser modificada por nadie
create policy "planillas_update_mutable_only" on public.planillas
  for update using (
    inmutable = false
    and (
      tecnico_id = auth.uid()
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
      )
    )
  );

-- SIN POLÍTICA DE DELETE — las planillas son documentos legales permanentes

-- Tabla de ítems de hidrantes (H-001 a H-048)
create table public.planilla_hidrantes (
  id             uuid primary key default gen_random_uuid(),
  planilla_id    uuid not null references public.planillas(id),
  numero         text not null,
  gabinete       boolean not null default false,
  manga          boolean not null default false,
  lanza          boolean not null default false,
  valvula        boolean not null default false,
  observaciones  text,
  foto_url       text
);

alter table public.planilla_hidrantes enable row level security;

-- Hereda acceso de la planilla padre
create policy "hidrantes_select" on public.planilla_hidrantes
  for select using (
    exists (
      select 1 from public.planillas p
      where p.id = planilla_id
        and (
          p.tecnico_id = auth.uid()
          or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
          )
        )
    )
  );

-- Solo se puede insertar si la planilla padre no es inmutable
create policy "hidrantes_insert" on public.planilla_hidrantes
  for insert with check (
    exists (
      select 1 from public.planillas p
      where p.id = planilla_id
        and p.inmutable = false
        and (
          p.tecnico_id = auth.uid()
          or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
          )
        )
    )
  );

-- Tabla de ítems de extintores (E-001 a E-113)
create table public.planilla_extintores (
  id             uuid primary key default gen_random_uuid(),
  planilla_id    uuid not null references public.planillas(id),
  numero         text not null,
  tipo           text not null,
  senalizacion   boolean not null default false,
  acceso         boolean not null default false,
  presion_peso   boolean not null default false,
  observaciones  text,
  foto_url       text
);

alter table public.planilla_extintores enable row level security;

create policy "extintores_select" on public.planilla_extintores
  for select using (
    exists (
      select 1 from public.planillas p
      where p.id = planilla_id
        and (
          p.tecnico_id = auth.uid()
          or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
          )
        )
    )
  );

create policy "extintores_insert" on public.planilla_extintores
  for insert with check (
    exists (
      select 1 from public.planillas p
      where p.id = planilla_id
        and p.inmutable = false
        and (
          p.tecnico_id = auth.uid()
          or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
          )
        )
    )
  );

-- Índices para búsquedas frecuentes
create index planillas_tecnico_fecha_turno on public.planillas (tecnico_id, tipo, fecha, turno);
create index planillas_created_at on public.planillas (created_at desc);

-- ROLLBACK
-- drop index if exists planillas_created_at;
-- drop index if exists planillas_tecnico_fecha_turno;
-- drop table if exists public.planilla_extintores;
-- drop table if exists public.planilla_hidrantes;
-- drop table if exists public.planillas;
