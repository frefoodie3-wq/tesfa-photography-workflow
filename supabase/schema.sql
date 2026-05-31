create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('gallery-previews', 'gallery-previews', true)
on conflict (id) do update set public = excluded.public;

create table if not exists public.galleries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  client_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  selection_limit integer not null default 100 check (selection_limit > 0),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  display_id text not null,
  file_name text not null,
  file_key text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (gallery_id, file_key)
);

create table if not exists public.selections (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gallery_id, photo_id)
);

alter table public.galleries enable row level security;
alter table public.photos enable row level security;
alter table public.selections enable row level security;

drop policy if exists "owners manage galleries" on public.galleries;
create policy "owners manage galleries"
on public.galleries
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "owners manage photos" on public.photos;
create policy "owners manage photos"
on public.photos
for all
to authenticated
using (
  exists (
    select 1 from public.galleries
    where galleries.id = photos.gallery_id
    and galleries.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.galleries
    where galleries.id = photos.gallery_id
    and galleries.owner_id = auth.uid()
  )
);

drop policy if exists "owners manage selections" on public.selections;
create policy "owners manage selections"
on public.selections
for all
to authenticated
using (
  exists (
    select 1 from public.galleries
    where galleries.id = selections.gallery_id
    and galleries.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.galleries
    where galleries.id = selections.gallery_id
    and galleries.owner_id = auth.uid()
  )
);

drop policy if exists "owners upload gallery previews" on storage.objects;
create policy "owners upload gallery previews"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gallery-previews'
  and exists (
    select 1 from public.galleries
    where galleries.id::text = (storage.foldername(name))[1]
    and galleries.owner_id = auth.uid()
  )
);

drop policy if exists "owners update gallery previews" on storage.objects;
create policy "owners update gallery previews"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'gallery-previews'
  and exists (
    select 1 from public.galleries
    where galleries.id::text = (storage.foldername(name))[1]
    and galleries.owner_id = auth.uid()
  )
);

drop policy if exists "owners delete gallery previews" on storage.objects;
create policy "owners delete gallery previews"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'gallery-previews'
  and exists (
    select 1 from public.galleries
    where galleries.id::text = (storage.foldername(name))[1]
    and galleries.owner_id = auth.uid()
  )
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists galleries_touch_updated_at on public.galleries;
create trigger galleries_touch_updated_at
before update on public.galleries
for each row execute function public.touch_updated_at();

create or replace function public.get_gallery_by_token(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'gallery', jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'slug', g.slug,
      'selection_limit', g.selection_limit,
      'deadline', g.deadline,
      'client_token', g.client_token
    ),
    'photos', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'display_id', p.display_id,
            'file_name', p.file_name,
            'file_key', p.file_key,
            'storage_path', p.storage_path
          )
          order by p.created_at
        )
        from public.photos p
        where p.gallery_id = g.id
      ),
      '[]'::jsonb
    ),
    'selected_photo_ids', coalesce(
      (
        select jsonb_agg(s.photo_id)
        from public.selections s
        where s.gallery_id = g.id
      ),
      '[]'::jsonb
    )
  )
  from public.galleries g
  where g.client_token = p_token
  limit 1;
$$;

create or replace function public.set_gallery_selection(
  p_token text,
  p_photo_id uuid,
  p_selected boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gallery public.galleries%rowtype;
  v_count integer;
begin
  select * into v_gallery
  from public.galleries
  where client_token = p_token;

  if v_gallery.id is null then
    raise exception 'Gallery not found';
  end if;

  if not exists (
    select 1 from public.photos
    where id = p_photo_id
    and gallery_id = v_gallery.id
  ) then
    raise exception 'Photo not found';
  end if;

  if p_selected then
    select count(*) into v_count
    from public.selections
    where gallery_id = v_gallery.id;

    if v_count >= v_gallery.selection_limit
      and not exists (
        select 1 from public.selections
        where gallery_id = v_gallery.id
        and photo_id = p_photo_id
      )
    then
      raise exception 'Selection limit reached';
    end if;

    insert into public.selections (gallery_id, photo_id)
    values (v_gallery.id, p_photo_id)
    on conflict (gallery_id, photo_id) do nothing;
  else
    delete from public.selections
    where gallery_id = v_gallery.id
    and photo_id = p_photo_id;
  end if;

  return public.get_gallery_by_token(p_token);
end;
$$;

grant execute on function public.get_gallery_by_token(text) to anon, authenticated;
grant execute on function public.set_gallery_selection(text, uuid, boolean) to anon, authenticated;
