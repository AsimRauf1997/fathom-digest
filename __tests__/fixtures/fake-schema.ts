// Minimal stand-ins for lib/db/schema.ts's exported table objects, used to
// satisfy `eq(invites.teamId, ...)`-style column references in action code
// under test, without needing a real Postgres connection.

export type FakeColumn = { _table: string; _field: string };

function col(table: string, field: string): FakeColumn {
  return { _table: table, _field: field };
}

export const users = {
  _table: "users",
  id: col("users", "id"),
  email: col("users", "email"),
  name: col("users", "name"),
  avatarUrl: col("users", "avatarUrl"),
};

export const teams = {
  _table: "teams",
  id: col("teams", "id"),
  name: col("teams", "name"),
  fathomApiKeyEnc: col("teams", "fathomApiKeyEnc"),
  createdAt: col("teams", "createdAt"),
};

export const teamMembers = {
  _table: "teamMembers",
  id: col("teamMembers", "id"),
  teamId: col("teamMembers", "teamId"),
  userId: col("teamMembers", "userId"),
  role: col("teamMembers", "role"),
  createdAt: col("teamMembers", "createdAt"),
};

export const invites = {
  _table: "invites",
  id: col("invites", "id"),
  teamId: col("invites", "teamId"),
  email: col("invites", "email"),
  invitedBy: col("invites", "invitedBy"),
  status: col("invites", "status"),
  invitedUserId: col("invites", "invitedUserId"),
  createdAt: col("invites", "createdAt"),
  acceptedAt: col("invites", "acceptedAt"),
};
