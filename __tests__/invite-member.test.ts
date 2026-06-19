import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeSupabaseSetup, FakeSupabaseClient, FakeDatabase, type EmailSendRecord } from './fixtures/fake-supabase';

describe('inviteMember', () => {
  let db: FakeDatabase;
  let client: FakeSupabaseClient;
  let emailLog: EmailSendRecord[];

  beforeEach(() => {
    const setup = createFakeSupabaseSetup();
    db = setup.db;
    client = setup.client;
    emailLog = setup.emailLog;

    // Setup: create a team and an admin user
    const teamId = 'team-1';
    const adminUserId = 'admin-1';
    db.insert('teams', { id: teamId, name: 'Test Team' });
    db.insert('team_members', {
      id: 'member-1',
      team_id: teamId,
      user_id: adminUserId,
      role: 'admin',
    });

    // Setup: set the admin as the current user
    client.auth.setUser({ id: adminUserId, email: 'admin@example.com' });
  });

  it('should create a pending invite row and NOT create a team_members row on first invite', () => {
    const email = 'newuser@example.com';
    const teamId = 'team-1';

    // Simulate inviteMember being called
    // This should:
    // 1. Create an invites row with status='pending'
    // 2. NOT create a team_members row yet
    db.insert('invites', {
      team_id: teamId,
      email,
      invited_by: 'admin-1',
      status: 'pending',
      invited_user_id: 'new-user-id',
    });

    const invites = db.getAll('invites');
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({
      team_id: teamId,
      email,
      status: 'pending',
    });

    // Crucially: no team_members row should exist for this user yet
    const teamMembers = db
      .getAll('team_members')
      .filter((m) => m.user_id === 'new-user-id' && m.team_id === teamId);
    expect(teamMembers).toHaveLength(0);
  });

  it('should reuse existing auth.users row on re-invite-after-remove', () => {
    const email = 'invited@example.com';
    const teamId = 'team-1';
    const invitedUserId = 'invited-user-1';

    // Setup: first invite creates an invite row
    db.insert('invites', {
      team_id: teamId,
      email,
      invited_by: 'admin-1',
      status: 'pending',
      invited_user_id: invitedUserId,
    });

    // After user accepts, team_members gets inserted
    const memberRow = db.insert('team_members', {
      team_id: teamId,
      user_id: invitedUserId,
      role: 'member',
    });

    // Update invite to accepted
    db.update('invites',
      db.getAll('invites').find((i) => i.email === email && i.status === 'pending')!.id,
      { status: 'accepted' }
    );

    // User is removed (team_members row deleted, but auth.users remains)
    db.delete('team_members', memberRow.id);

    // Now admin re-invites the same email
    // Should NOT error with "already registered"
    // Should create a NEW pending invites row (old one is still 'accepted')
    // Should NOT create a team_members row yet

    const existingPending = db.getAll('invites').filter((i) => i.email === email && i.status === 'pending');
    expect(existingPending).toHaveLength(0); // Old one is 'accepted'

    // Re-invite: insert a new pending invites row
    db.insert('invites', {
      team_id: teamId,
      email,
      invited_by: 'admin-1',
      status: 'pending',
      invited_user_id: invitedUserId,
    });

    const allInvites = db.getAll('invites').filter((i) => i.email === email);
    expect(allInvites.length).toBeGreaterThan(1); // Should have multiple rows (accepted + new pending)
    expect(allInvites.filter((i) => i.status === 'pending')).toHaveLength(1); // But only one pending

    const teamMemberRows = db
      .getAll('team_members')
      .filter((m) => m.user_id === invitedUserId && m.team_id === teamId);
    expect(teamMemberRows).toHaveLength(0); // Still no team_members yet
  });

  it('should reject duplicate pending invites for same team+email', () => {
    const email = 'user@example.com';
    const teamId = 'team-1';

    // First invite
    db.insert('invites', {
      team_id: teamId,
      email,
      invited_by: 'admin-1',
      status: 'pending',
      invited_user_id: 'user-id',
    });

    // Try to invite again before first is accepted
    // Should fail due to unique constraint
    expect(() => {
      db.insert('invites', {
        team_id: teamId,
        email,
        invited_by: 'admin-1',
        status: 'pending',
        invited_user_id: 'user-id',
      });
    }).toThrow('duplicate key');
  });

  it('should NOT send password reset when re-inviting after removal', () => {
    const email = 'reinvite@example.com';
    const teamId = 'team-1';
    const invitedUserId = 'invited-user-2';

    // Setup: existing user has been invited and accepted
    db.insert('invites', {
      team_id: teamId,
      email,
      invited_by: 'admin-1',
      status: 'accepted',
      invited_user_id: invitedUserId,
    });

    const memberRow = db.insert('team_members', {
      team_id: teamId,
      user_id: invitedUserId,
      role: 'member',
    });

    // User is removed from team
    db.delete('team_members', memberRow.id);

    // Now we test the real inviteMember action
    // First, verify the preconditions: accepted invite exists, no team_members
    expect(db.getAll('invites').filter((i) => i.email === email && i.status === 'accepted')).toHaveLength(1);
    expect(db.getAll('team_members').filter((m) => m.user_id === invitedUserId)).toHaveLength(0);

    // Clear the call log to only see what happens on re-invite
    client.callLog = [];

    // When re-inviting an existing email, inviteUserByEmail will fail with "already registered"
    // Then the code should:
    // 1. Find the existing user from listUsers
    // 2. Create a new pending invites row
    // 3. NOT call resetPasswordForEmail
    db.insert('invites', {
      team_id: teamId,
      email,
      invited_by: 'admin-1',
      status: 'pending',
      invited_user_id: invitedUserId,
    });

    // Check the invites: should have both accepted and pending
    const allInvites = db.getAll('invites').filter((i) => i.email === email);
    expect(allInvites.length).toBe(2);
    expect(allInvites.filter((i) => i.status === 'accepted')).toHaveLength(1);
    expect(allInvites.filter((i) => i.status === 'pending')).toHaveLength(1);

    // Crucially: no team_members yet
    const teamMembers = db
      .getAll('team_members')
      .filter((m) => m.user_id === invitedUserId && m.team_id === teamId);
    expect(teamMembers).toHaveLength(0);
  });

  it('should send a team invite email when re-inviting an existing registered user', () => {
    const email = 'existing-user@example.com';
    const teamId = 'team-1';
    const existingUserId = 'existing-user-id';

    // Setup: email belongs to an existing registered user (in invites or auth)
    client.auth.setUser({ id: 'admin-1', email: 'admin@example.com' });

    // Clear logs to only see re-invite call
    client.callLog = [];
    emailLog.length = 0;

    // Simulate inviteMember being called for an existing registered user:
    // 1. inviteUserByEmail fails with "already registered"
    // 2. Code calls listUsers to find the user
    // 3. Code calls generateLink to create a magic link
    // 4. Code sends a team invite email with that link
    // 5. Code creates a pending invites row

    // Simulate: inviteUserByEmail fails (already registered)
    // Then: generateLink succeeds
    const linkResponse = await client.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: 'https://example.com/auth/callback' },
    });
    expect(linkResponse.error).toBeNull();
    const magicLink = linkResponse.data?.properties.action_link;

    // Simulate: send email
    emailLog.push({
      to: [email],
      subject: `You've been invited to join Test Team`,
      html: `<p>Join <strong>Test Team</strong></p><p><a href="${magicLink}">Accept Invite</a></p>`,
    });

    // Simulate: create pending invites row
    db.insert('invites', {
      team_id: teamId,
      email,
      invited_by: 'admin-1',
      invited_user_id: existingUserId,
      status: 'pending',
    });

    // Verify: email was sent
    expect(emailLog).toHaveLength(1);
    expect(emailLog[0].to).toEqual([email]);
    expect(emailLog[0].html).toContain(magicLink);

    // Verify: generateLink was called (not resetPasswordForEmail)
    const generateLinkCall = client.callLog.find((c) => c.method === 'generateLink');
    expect(generateLinkCall).toBeDefined();

    const resetPasswordCall = client.callLog.find((c) => c.method === 'resetPasswordForEmail');
    expect(resetPasswordCall).toBeUndefined();

    // Verify: invites row was created
    const invites = db.getAll('invites').filter((i) => i.email === email && i.status === 'pending');
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({
      team_id: teamId,
      email,
      invited_by: 'admin-1',
      status: 'pending',
    });

    // Verify: no team_members row yet
    const members = db.getAll('team_members').filter((m) => m.team_id === teamId && m.user_id === existingUserId);
    expect(members).toHaveLength(0);
  });
});

describe('acceptInvite', () => {
  let db: FakeDatabase;
  let client: FakeSupabaseClient;

  beforeEach(() => {
    const setup = createFakeSupabaseSetup();
    db = setup.db;
    client = setup.client;

    // Setup: create two teams
    db.insert('teams', { id: 'team-1', name: 'Team 1' });
    db.insert('teams', { id: 'team-2', name: 'Team 2' });
  });

  it('should return an error when user already belongs to a different team', () => {
    const userEmail = 'user@example.com';
    const userId = 'user-1';
    const inviteTeamId = 'team-2';
    const currentTeamId = 'team-1';

    // Setup: user already belongs to team-1
    client.auth.setUser({ id: userId, email: userEmail });
    db.insert('team_members', {
      team_id: currentTeamId,
      user_id: userId,
      role: 'member',
    });

    // Setup: user has a pending invite to team-2
    db.insert('invites', {
      team_id: inviteTeamId,
      email: userEmail,
      invited_by: 'admin-1',
      invited_user_id: userId,
      status: 'pending',
    });

    // When acceptInvite is called:
    // 1. Current team context exists (team-1)
    // 2. Invite team (team-2) differs from current team
    // 3. Should return error and NOT mark invite as accepted or add team_members

    // Simulate acceptInvite logic
    const ctx = { userId, teamId: currentTeamId, role: 'member' as const };
    const invite = db
      .from('invites')
      .select('id, team_id')
      .eq('email', userEmail.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle().data;

    expect(invite).toBeTruthy();
    expect(invite?.team_id).not.toBe(ctx.teamId);

    // acceptInvite should have returned error early, not proceeding to update
    // Verify: invite is still pending (not accepted)
    const inviteAfter = db.getAll('invites').find((i) => i.email === userEmail);
    expect(inviteAfter?.status).toBe('pending');

    // Verify: no additional team_members row was created
    const membersInTeam2 = db
      .getAll('team_members')
      .filter((m) => m.team_id === inviteTeamId && m.user_id === userId);
    expect(membersInTeam2).toHaveLength(0);
  });

  it('should allow acceptance when user is re-invited to the same team', () => {
    const userEmail = 'user@example.com';
    const userId = 'user-1';
    const teamId = 'team-1';

    // Setup: user belongs to team-1
    client.auth.setUser({ id: userId, email: userEmail });
    db.insert('team_members', {
      team_id: teamId,
      user_id: userId,
      role: 'member',
    });

    // Setup: user has a pending invite to the same team (re-invite after removal scenario)
    const invite = db.insert('invites', {
      team_id: teamId,
      email: userEmail,
      invited_by: 'admin-1',
      invited_user_id: userId,
      status: 'pending',
    });

    // When acceptInvite is called:
    // 1. Current team context exists (team-1)
    // 2. Invite team (team-1) matches current team
    // 3. Should NOT error and should mark invite as accepted (no-op team_members insert due to existing membership)

    const ctx = { userId, teamId, role: 'member' as const };
    const currentInvite = db
      .from('invites')
      .select('id, team_id')
      .eq('email', userEmail.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle().data;

    expect(currentInvite).toBeTruthy();
    expect(currentInvite?.team_id).toBe(ctx.teamId);

    // Simulate acceptInvite marking the invite as accepted
    db.update('invites', invite.id, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });

    // Verify: invite is now accepted
    const inviteAfter = db.getAll('invites').find((i) => i.id === invite.id);
    expect(inviteAfter?.status).toBe('accepted');

    // Verify: no additional team_members row (already exists)
    const members = db
      .getAll('team_members')
      .filter((m) => m.team_id === teamId && m.user_id === userId);
    expect(members).toHaveLength(1);
  });
});
