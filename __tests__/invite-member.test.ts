import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fakeSchema from "./fixtures/fake-schema";
import * as fakeDrizzleOrm from "./fixtures/fake-drizzle-orm";
import { createFakeDb, type FakeDb } from "./fixtures/fake-db";
import { createFakeClerkClient, makeClerkUser } from "./fixtures/fake-clerk";

const fakeDb: FakeDb = createFakeDb();
const fakeClerk = createFakeClerkClient();

vi.mock("@/lib/db", () => ({ db: fakeDb }));
vi.mock("@/lib/db/schema", () => fakeSchema);
vi.mock("drizzle-orm", () => fakeDrizzleOrm);
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn(async () => fakeClerk),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/mailer", () => ({ sendEmail: vi.fn(async () => ({})) }));
vi.mock("@/lib/render-email", () => ({
  renderTeamInviteEmail: vi.fn(async () => ({
    subject: "invite-subject",
    html: "<p>invite</p>",
    text: "invite",
  })),
}));

async function loadModules() {
  const { auth, currentUser, clerkClient } = await import("@clerk/nextjs/server");
  const { sendEmail } = await import("@/lib/mailer");
  const settingsActions = await import("@/app/settings/actions");
  const acceptInviteActions = await import("@/app/accept-invite/actions");
  return {
    auth: auth as unknown as ReturnType<typeof vi.fn>,
    currentUser: currentUser as unknown as ReturnType<typeof vi.fn>,
    clerkClient: clerkClient as unknown as ReturnType<typeof vi.fn>,
    sendEmail: sendEmail as unknown as ReturnType<typeof vi.fn>,
    ...settingsActions,
    ...acceptInviteActions,
  };
}

function asAdmin(authMock: ReturnType<typeof vi.fn>, userId: string) {
  authMock.mockResolvedValue({ userId });
}

beforeEach(() => {
  fakeDb._data.teams.length = 0;
  fakeDb._data.teamMembers.length = 0;
  fakeDb._data.invites.length = 0;
  fakeDb._data.users.length = 0;
  fakeClerk._users.length = 0;
  fakeClerk._invitations.length = 0;
  vi.clearAllMocks();
});

describe("inviteMember", () => {
  it("creates a Clerk hosted invitation for a brand-new email, no team_members row yet", async () => {
    const { auth, inviteMember } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Test Team" });
    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" });

    const formData = new FormData();
    formData.set("email", "newuser@example.com");
    const result = await inviteMember(null, formData);

    expect(result).toBeNull();
    expect(fakeClerk.invitations.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: "newuser@example.com" }),
    );

    const invites = fakeDb._data.invites.filter((i) => i.email === "newuser@example.com");
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({ status: "pending", invitedUserId: null });

    const members = fakeDb._data.teamMembers.filter((m) => m.teamId === "team-1" && m.userId !== "admin-1");
    expect(members).toHaveLength(0);
  });

  it("sends the custom SendGrid email (no Clerk invitation) for an already-registered email", async () => {
    const { auth, inviteMember, sendEmail } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Test Team" });
    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" });
    fakeClerk._users.push(makeClerkUser("admin-1", "admin@example.com"));
    fakeClerk._users.push(makeClerkUser("existing-user-1", "existing@example.com"));

    const formData = new FormData();
    formData.set("email", "existing@example.com");
    const result = await inviteMember(null, formData);

    expect(result).toBeNull();
    expect(fakeClerk.invitations.createInvitation).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["existing@example.com"] }),
    );

    const invites = fakeDb._data.invites.filter((i) => i.email === "existing@example.com");
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({ status: "pending", invitedUserId: "existing-user-1" });
  });

  it("rejects a duplicate pending invite for the same team+email", async () => {
    const { auth, inviteMember } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Test Team" });
    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" });
    fakeDb._data.invites.push({
      id: "invite-1",
      teamId: "team-1",
      email: "dup@example.com",
      status: "pending",
      invitedBy: "admin-1",
      invitedUserId: null,
      createdAt: new Date(),
    });

    const formData = new FormData();
    formData.set("email", "dup@example.com");
    const result = await inviteMember(null, formData);

    expect(result).toEqual({ error: "This email already has a pending invite." });
  });

  it("reuses the existing Clerk account on re-invite after removal, without creating team_members", async () => {
    const { auth, inviteMember } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Test Team" });
    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" });
    fakeClerk._users.push(makeClerkUser("admin-1", "admin@example.com"));
    fakeClerk._users.push(makeClerkUser("invited-user-1", "invited@example.com"));
    // Prior accepted invite + already-removed membership from a previous cycle.
    fakeDb._data.invites.push({
      id: "old-invite",
      teamId: "team-1",
      email: "invited@example.com",
      status: "accepted",
      invitedBy: "admin-1",
      invitedUserId: "invited-user-1",
      createdAt: new Date(),
    });

    const formData = new FormData();
    formData.set("email", "invited@example.com");
    const result = await inviteMember(null, formData);

    expect(result).toBeNull();
    const allInvites = fakeDb._data.invites.filter((i) => i.email === "invited@example.com");
    expect(allInvites).toHaveLength(2);
    expect(allInvites.filter((i) => i.status === "pending")).toHaveLength(1);
    const members = fakeDb._data.teamMembers.filter((m) => m.userId === "invited-user-1");
    expect(members).toHaveLength(0);
  });
});

describe("resendInvite", () => {
  it("revokes and recreates the Clerk invitation for a not-yet-registered invitee", async () => {
    const { auth, inviteMember, resendInvite } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Test Team" });
    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" });

    const formData = new FormData();
    formData.set("email", "newuser@example.com");
    await inviteMember(null, formData);
    const invite = fakeDb._data.invites[0];
    expect(fakeClerk._invitations).toHaveLength(1);

    const resendForm = new FormData();
    resendForm.set("inviteId", invite.id as string);
    const result = await resendInvite(null, resendForm);

    expect(result).toBeNull();
    expect(fakeClerk.invitations.revokeInvitation).toHaveBeenCalledTimes(1);
    expect(fakeClerk.invitations.createInvitation).toHaveBeenCalledTimes(2);
  });

  it("resends the custom email (no Clerk call) for an already-registered invitee", async () => {
    const { auth, inviteMember, resendInvite, sendEmail } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Test Team" });
    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" });
    fakeClerk._users.push(makeClerkUser("admin-1", "admin@example.com"));
    fakeClerk._users.push(makeClerkUser("existing-user-1", "existing@example.com"));

    const formData = new FormData();
    formData.set("email", "existing@example.com");
    await inviteMember(null, formData);
    const invite = fakeDb._data.invites[0];
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const resendForm = new FormData();
    resendForm.set("inviteId", invite.id as string);
    const result = await resendInvite(null, resendForm);

    expect(result).toBeNull();
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(fakeClerk.invitations.createInvitation).not.toHaveBeenCalled();
  });
});

describe("acceptInvite", () => {
  it("blocks accepting an invite to a different team than the caller's current team", async () => {
    const { auth, acceptInvite } = await loadModules();
    fakeDb._data.teams.push({ id: "team-1", name: "Team 1" }, { id: "team-2", name: "Team 2" });
    fakeClerk._users.push(makeClerkUser("user-1", "user@example.com"));
    asAdmin(auth, "user-1");

    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "user-1", role: "member" });
    fakeDb._data.invites.push({
      id: "invite-1",
      teamId: "team-2",
      email: "user@example.com",
      status: "pending",
      invitedBy: "admin-2",
      invitedUserId: "user-1",
      createdAt: new Date(),
    });

    const result = await acceptInvite();

    expect(result).toEqual({
      error: "You're already part of a team. Leave your current team before accepting this invite.",
    });
    const invite = fakeDb._data.invites.find((i) => i.id === "invite-1");
    expect(invite?.status).toBe("pending");
    const team2Members = fakeDb._data.teamMembers.filter((m) => m.teamId === "team-2");
    expect(team2Members).toHaveLength(0);
  });

  it("accepts a re-invite to the same team without creating a duplicate membership", async () => {
    const { auth, acceptInvite } = await loadModules();
    fakeDb._data.teams.push({ id: "team-1", name: "Team 1" });
    fakeClerk._users.push(makeClerkUser("user-1", "user@example.com"));
    asAdmin(auth, "user-1");

    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "user-1", role: "member" });
    fakeDb._data.invites.push({
      id: "invite-1",
      teamId: "team-1",
      email: "user@example.com",
      status: "pending",
      invitedBy: "admin-1",
      invitedUserId: "user-1",
      createdAt: new Date(),
    });

    const result = await acceptInvite();

    expect(result).toBeNull();
    const invite = fakeDb._data.invites.find((i) => i.id === "invite-1");
    expect(invite?.status).toBe("accepted");
    const members = fakeDb._data.teamMembers.filter((m) => m.teamId === "team-1" && m.userId === "user-1");
    expect(members).toHaveLength(1);
  });
});

describe("last-admin invariant", () => {
  it("blocks demoting the last admin", async () => {
    const { auth, updateMemberRole } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Team 1" });
    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" });

    const formData = new FormData();
    formData.set("memberId", "member-1");
    formData.set("role", "member");
    const result = await updateMemberRole(null, formData);

    expect(result).toEqual({ error: "Cannot remove the last admin." });
    const member = fakeDb._data.teamMembers.find((m) => m.id === "member-1");
    expect(member?.role).toBe("admin");
  });

  it("blocks removing the last admin", async () => {
    const { auth, removeMember } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Team 1" });
    fakeDb._data.teamMembers.push({ id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" });

    const formData = new FormData();
    formData.set("memberId", "member-1");
    const result = await removeMember(null, formData);

    expect(result).toEqual({ error: "Cannot remove the last admin." });
    expect(fakeDb._data.teamMembers).toHaveLength(1);
  });

  it("allows removing a non-last admin", async () => {
    const { auth, removeMember } = await loadModules();
    asAdmin(auth, "admin-1");
    fakeDb._data.teams.push({ id: "team-1", name: "Team 1" });
    fakeDb._data.teamMembers.push(
      { id: "member-1", teamId: "team-1", userId: "admin-1", role: "admin" },
      { id: "member-2", teamId: "team-1", userId: "admin-2", role: "admin" },
    );

    const formData = new FormData();
    formData.set("memberId", "member-2");
    const result = await removeMember(null, formData);

    expect(result).toBeNull();
    expect(fakeDb._data.teamMembers).toHaveLength(1);
  });
});

describe("createTeam", () => {
  it("creates a team and makes the caller its admin", async () => {
    const { auth, currentUser } = await loadModules();
    const { createTeam } = await import("@/app/onboarding/actions");
    asAdmin(auth, "user-1");
    currentUser.mockResolvedValue({
      id: "user-1",
      emailAddresses: [{ emailAddress: "user@example.com" }],
      firstName: "Test",
      lastName: "User",
      imageUrl: null,
    });

    const formData = new FormData();
    formData.set("name", "Brand New Team");

    await expect(createTeam(null, formData)).rejects.toThrow("REDIRECT:/");

    expect(fakeDb._data.teams).toHaveLength(1);
    expect(fakeDb._data.teams[0]).toMatchObject({ name: "Brand New Team" });
    const teamId = fakeDb._data.teams[0].id;
    const members = fakeDb._data.teamMembers.filter((m) => m.teamId === teamId);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId: "user-1", role: "admin" });
  });
});
