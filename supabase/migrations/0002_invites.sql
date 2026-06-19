-- fathom-digest: invite status tracking (pending/accepted/revoked).
-- Apply via the Supabase Dashboard SQL Editor (no Supabase CLI/Edge Functions used).
--
-- This table is a status ledger only — the actual invite token, expiry, and
-- email delivery are still owned by Supabase Auth (auth.admin.inviteUserByEmail /
-- auth.verifyOtp). team_members rows are now created in acceptInvite(), not at
-- invite-send time, so this table is what makes "pending" vs "accepted" real.

create type invite_status as enum ('pending', 'accepted', 'revoked');

create table invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete set null,
  status invite_status not null default 'pending',
  invited_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint invites_email_lower check (email = lower(email))
);

-- Only one *pending* invite per (team, email) at a time. Accepted/revoked
-- rows are kept for history, so a re-invite after accept/revoke is a fresh
-- row, not a conflict.
create unique index invites_pending_unique
  on invites (team_id, lower(email))
  where status = 'pending';

create index invites_team_id_idx on invites(team_id);
create index invites_email_idx on invites(lower(email));

alter table invites enable row level security;

-- All writes go through createAdminClient() (service_role), same as
-- team_members today, so only a team-scoped select policy is needed (for
-- rendering the settings page's pending-invites list).
create policy invites_select_admin on invites for select to authenticated
  using (is_team_admin(team_id));
