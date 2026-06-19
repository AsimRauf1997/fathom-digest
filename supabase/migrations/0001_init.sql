-- fathom-digest: teams, team membership, and encrypted-at-rest Fathom API keys.
-- Apply via the Supabase Dashboard SQL Editor (no Supabase CLI/Edge Functions used).

create extension if not exists pgcrypto;

create type team_role as enum ('admin', 'member');

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fathom_api_key_enc bytea,
  created_at timestamptz not null default now()
);

create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role team_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (user_id)
);
create index team_members_team_id_idx on team_members(team_id);

alter table teams enable row level security;
alter table team_members enable row level security;

-- Non-recursive helpers: SECURITY DEFINER lets these bypass RLS internally
-- so policies that call them don't recursively re-trigger RLS on team_members.
create or replace function my_team_id() returns uuid
language sql security definer set search_path = public stable as $$
  select team_id from team_members where user_id = auth.uid() limit 1;
$$;

create or replace function is_team_admin(p_team_id uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from team_members
    where team_id = p_team_id and user_id = auth.uid() and role = 'admin');
$$;

revoke all on function my_team_id() from public, anon;
revoke all on function is_team_admin(uuid) from public, anon;
grant execute on function my_team_id() to authenticated;
grant execute on function is_team_admin(uuid) to authenticated;

-- teams policies
create policy teams_select on teams for select to authenticated
  using (id = my_team_id());
create policy teams_insert on teams for insert to authenticated
  with check (true);
create policy teams_update on teams for update to authenticated
  using (is_team_admin(id)) with check (is_team_admin(id));

-- team_members policies
create policy team_members_select on team_members for select to authenticated
  using (team_id = my_team_id());
create policy team_members_insert_self on team_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not exists (select 1 from team_members where user_id = (select auth.uid()))
  );
create policy team_members_update_admin on team_members for update to authenticated
  using (is_team_admin(team_id)) with check (is_team_admin(team_id));
create policy team_members_delete_admin on team_members for delete to authenticated
  using (is_team_admin(team_id));

-- Fathom key encrypt/decrypt: the passphrase is passed per-call from Next.js
-- (process.env.SUPABASE_DB_ENCRYPTION_KEY) and never stored in the DB.
-- Restricted to service_role only — callable solely from the server-side
-- admin client (lib/supabase/admin.ts), never from anon/authenticated.
-- Supabase installs pgcrypto into the `extensions` schema, not `public`, so
-- these need it on the search_path to resolve pgp_sym_encrypt/decrypt.
create or replace function set_team_fathom_key(p_team_id uuid, p_plaintext_key text, p_passphrase text)
returns void language sql security definer set search_path = public, extensions as $$
  update teams set fathom_api_key_enc = pgp_sym_encrypt(p_plaintext_key, p_passphrase) where id = p_team_id;
$$;

create or replace function get_team_fathom_key(p_team_id uuid, p_passphrase text)
returns text language sql security definer set search_path = public, extensions stable as $$
  select pgp_sym_decrypt(fathom_api_key_enc, p_passphrase) from teams where id = p_team_id;
$$;

revoke all on function set_team_fathom_key(uuid, text, text) from public, authenticated, anon;
revoke all on function get_team_fathom_key(uuid, text) from public, authenticated, anon;
grant execute on function set_team_fathom_key(uuid, text, text) to service_role;
grant execute on function get_team_fathom_key(uuid, text) to service_role;
