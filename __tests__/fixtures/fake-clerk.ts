import { vi } from "vitest";

export interface FakeClerkUser {
  id: string;
  emailAddresses: { id: string; emailAddress: string }[];
  primaryEmailAddressId: string;
}

export function makeClerkUser(id: string, email: string): FakeClerkUser {
  return {
    id,
    emailAddresses: [{ id: `${id}-email`, emailAddress: email }],
    primaryEmailAddressId: `${id}-email`,
  };
}

export function createFakeClerkClient(initialUsers: FakeClerkUser[] = []) {
  const users = [...initialUsers];
  const invitations: { id: string; emailAddress: string; status: string }[] = [];
  let invitationCounter = 0;

  const client = {
    users: {
      getUser: vi.fn(async (id: string) => {
        const user = users.find((u) => u.id === id);
        if (!user) throw new Error(`Clerk user not found: ${id}`);
        return user;
      }),
      getUserList: vi.fn(async ({ emailAddress }: { emailAddress: string[] }) => {
        const wanted = emailAddress.map((e) => e.toLowerCase());
        const data = users.filter((u) =>
          u.emailAddresses.some((e) => wanted.includes(e.emailAddress.toLowerCase())),
        );
        return { data, totalCount: data.length };
      }),
    },
    invitations: {
      createInvitation: vi.fn(async ({ emailAddress }: { emailAddress: string }) => {
        const invitation = {
          id: `inv_${++invitationCounter}`,
          emailAddress,
          status: "pending",
        };
        invitations.push(invitation);
        return invitation;
      }),
      getInvitationList: vi.fn(async ({ query, status }: { query?: string; status?: string }) => {
        const data = invitations.filter(
          (inv) =>
            (!query || inv.emailAddress.toLowerCase() === query.toLowerCase()) &&
            (!status || inv.status === status),
        );
        return { data, totalCount: data.length };
      }),
      revokeInvitation: vi.fn(async (id: string) => {
        const invitation = invitations.find((inv) => inv.id === id);
        if (invitation) invitation.status = "revoked";
        return invitation;
      }),
    },
    _users: users,
    _invitations: invitations,
  };

  return client;
}
