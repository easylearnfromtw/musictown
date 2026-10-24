-- CITYMUS member playlists and publishable read-only embed keys.
-- Run once in the SQL editor of the dedicated Supabase project.
-- No service-role credentials belong in browser code.
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
create table if not exists public.citymus_embed_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id uuid not null references public.citymus_playlists(id) on delete cascade,
  name text not null default 'My website',
  key_prefix text not null,
  key_hash text not null unique,
  allowed_domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists citymus_embed_keys_owner_idx on public.citymus_embed_keys(user_id);
create index if not exists citymus_embed_keys_playlist_idx on public.citymus_embed_keys(playlist_id);
alter table public.citymus_playlists enable row level security;
alter table public.citymus_embed_keys enable row level security;
-- All CRUD goes through authorized server endpoints; public REST access is denied.
revoke all on public.citymus_playlists from anon, authenticated;
revoke all on public.citymus_embed_keys from anon, authenticated;
-- Service role remains the only database API principal used by the server.
