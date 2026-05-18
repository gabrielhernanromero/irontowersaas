-- MIGRACIÓN 4: Buckets de Supabase Storage

-- Bucket para firmas digitales (PNG)
insert into storage.buckets (id, name, public)
values ('firmas', 'firmas', false);

-- Bucket para fotos de campo (JPG)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false);

-- Bucket para PDFs generados
insert into storage.buckets (id, name, public)
values ('informes', 'informes', false);

-- RLS en Storage: firmas
-- Cada técnico puede subir a su propia carpeta: firmas/{userId}/...
create policy "firmas_insert" on storage.objects
  for insert with check (
    bucket_id = 'firmas'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Técnico ve solo sus firmas; supervisor/admin ven todas
create policy "firmas_select" on storage.objects
  for select using (
    bucket_id = 'firmas'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
      )
    )
  );

-- RLS en Storage: fotos
create policy "fotos_insert" on storage.objects
  for insert with check (
    bucket_id = 'fotos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "fotos_select" on storage.objects
  for select using (
    bucket_id = 'fotos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
      )
    )
  );

-- RLS en Storage: informes (solo supervisores/admins)
create policy "informes_insert" on storage.objects
  for insert with check (
    bucket_id = 'informes'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
    )
  );

create policy "informes_select" on storage.objects
  for select using (
    bucket_id = 'informes'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.rol in ('admin', 'supervisor')
    )
  );

-- ROLLBACK
-- delete from storage.buckets where id in ('firmas', 'fotos', 'informes');
