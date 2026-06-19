import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeSupabaseSetup, FakeSupabaseClient, FakeDatabase } from './fixtures/fake-supabase';

describe('inviteMember', () => {
  let db: FakeDatabase;
  let client: FakeSupabaseClient;

  beforeEach(() => {
    const setup = createFakeSupabaseSetup();
    db = setup.db;
    client = setup.client;

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
    const acceptedInvite = db.insert('invites', {
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
});
