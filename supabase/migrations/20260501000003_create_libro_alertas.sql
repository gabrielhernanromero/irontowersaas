-- MIGRACIÓN 3: Libro de guardia y alertas

create table public.libro_guardia (
  id                    uuid primary key default gen_random_uuid(),
  planilla_id           uuid references public.planillas(id),
  tecnico_id            uuid not null references public.users(id),
  hora                  time not null,
  riesgo_detectado      text not null,
  medidas_adoptadas     text not null,
  observaciones_generales text,
  foto_url              text,
  created_at            timestamptz not null default now()
);

alter table public.libro_guardia enable row level security;

create policy "libro_select" on public.libro_guardia
  for select using (
    tecnico_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
    )
  );

create policy "libro_insert" on public.libro_guardia
  for insert with check (
    tecnico_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
    )
  );

-- Tabla de alertas
create table public.alertas (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null check (
                     tipo in ('novedad_planilla', 'planilla_pendiente', 'certificacion_vence')
                   ),
  mensaje          text not null,
  leida            boolean not null default false,
  destinatario_id  uuid not null references public.users(id),
  planilla_id      uuid references public.planillas(id),
  created_at       timestamptz not null default now()
);

alter table public.alertas enable row level security;

-- Cada usuario ve solo sus propias alertas; admins ven todas
create policy "alertas_select" on public.alertas
  for select using (
    destinatario_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- Solo el destinatario puede marcar como leída
create policy "alertas_update" on public.alertas
  for update using (destinatario_id = auth.uid());

-- El sistema inserta alertas via supabaseAdmin() (service role bypasea RLS)
-- No hay política de INSERT anon porque solo la usamos desde el backend

create index alertas_destinatario_leida on public.alertas (destinatario_id, leida, created_at desc);
create index libro_guardia_tecnico on public.libro_guardia (tecnico_id, created_at desc);

-- ROLLBACK
-- drop index if exists libro_guardia_tecnico;
-- drop index if exists alertas_destinatario_leida;
-- drop table if exists public.alertas;
-- drop table if exists public.libro_guardia;
