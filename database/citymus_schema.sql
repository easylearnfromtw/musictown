-- CITYMUS member playlists + per-website authorization bindings.
-- Everyone shares the same PUBLIC API identifier; it is not an authentication secret.
-- Run in the SQL editor of the dedicated Supabase project.
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
-- Membership endpoints authorize by Supabase Auth bearer token and user_id on server.
-- Direct Data API access is denied to browsers even if they carry a valid user JWT.
revoke all on public.citymus_playlists from anon, authenticated;
revoke all on public.citymus_integrations from anon, authenticated;
-- If an early beta created the old per-user keys table, keep it inactive and inaccessible.
-- Never expose a service-role key in the frontend.
