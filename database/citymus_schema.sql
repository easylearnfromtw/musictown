-- CITYMUS production: per-member playlists and website registration.
-- All HTTP endpoints use a legacy public Supabase anon JWT. Owner-scoped mutations
-- carry the validated end-user JWT and are always checked again by Postgres RLS.
-- Public playlist access is intentionally read-only through one constrained RPC.
create table if not exists public.citymus_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 90),
  description text not null default '',
  tracks jsonb not null default '[]'::jsonb check (jsonb_typeof(tracks) = 'array' and jsonb_array_length(tracks) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists citymus_playlists_owner_idx on public.citymus_playlists(user_id);

create table if not exists public.citymus_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id uuid not null references public.citymus_playlists(id) on delete cascade,
  name text not null default 'My website',
  allowed_domains text[] not null check (cardinality(allowed_domains) between 1 and 10),
  terms_accepted_at timestamptz not null,
  terms_version text not null default 'citymus-attribution-v1',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists citymus_integrations_owner_idx on public.citymus_integrations(user_id);
create index if not exists citymus_integrations_playlist_idx on public.citymus_integrations(playlist_id);
alter table public.citymus_playlists enable row level security;
alter table public.citymus_integrations enable row level security;
revoke all on public.citymus_playlists from anon, authenticated;
revoke all on public.citymus_integrations from anon, authenticated;
grant select, insert, update, delete on public.citymus_playlists to authenticated;
grant select, insert, update on public.citymus_integrations to authenticated;

create policy citymus_playlists_owner_read on public.citymus_playlists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy citymus_playlists_owner_insert on public.citymus_playlists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy citymus_playlists_owner_update on public.citymus_playlists
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy citymus_playlists_owner_delete on public.citymus_playlists
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy citymus_integrations_owner_read on public.citymus_integrations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy citymus_integrations_owner_insert on public.citymus_integrations
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and terms_version = 'citymus-attribution-v1'
    and terms_accepted_at is not null
    and exists (
      select 1 from public.citymus_playlists p
      where p.id = playlist_id and p.user_id = (select auth.uid())
    )
  );
create policy citymus_integrations_owner_update on public.citymus_integrations
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and terms_version = 'citymus-attribution-v1'
    and exists (
      select 1 from public.citymus_playlists p
      where p.id = playlist_id and p.user_id = (select auth.uid())
    )
  );

-- SECURITY DEFINER here is narrowly limited to public, explicitly authorized
-- playlists and is needed because anonymous users must never SELECT entire tables.
-- No dynamic SQL, no user-controlled search_path, no secret information returned.
create or replace function public.citymus_resolve_integration(
  p_api_key text, p_integration uuid
) returns jsonb
language sql stable security definer set search_path = ''
as $citymus$
  select jsonb_build_object(
    'playlist', jsonb_build_object(
      'name', p.name,
      'description', p.description,
      'tracks', p.tracks
    ),
    'allowed_domains', i.allowed_domains
  )
  from public.citymus_integrations i
  join public.citymus_playlists p
    on p.id = i.playlist_id and p.user_id = i.user_id
  where p_api_key = 'cm_public_v1'
    and i.id = p_integration
    and i.revoked_at is null
    and i.terms_accepted_at is not null
    and i.terms_version = 'citymus-attribution-v1'
  limit 1;
$citymus$;
revoke all on function public.citymus_resolve_integration(text, uuid) from public;
grant execute on function public.citymus_resolve_integration(text, uuid) to anon, authenticated;
