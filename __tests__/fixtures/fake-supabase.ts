// Hand-rolled fake Supabase client for integration tests.
// Mocks createClient() and createAdminClient() interfaces used by server actions.

export type FakeAuthUser = {
  id: string;
  email: string;
  email_confirmed_at?: string;
};

export type FakeSupabaseRow = Record<string, unknown>;

export class FakeDatabase {
  private tables: Map<string, FakeSupabaseRow[]> = new Map();
  private uniqueConstraints: Map<string, Set<string>> = new Map();

  constructor() {
    this.tables.set("teams", []);
    this.tables.set("team_members", []);
    this.tables.set("invites", []);
    this.uniqueConstraints.set("team_members:user_id", new Set());
  }

  insert(table: string, row: FakeSupabaseRow): FakeSupabaseRow {
    // Enforce team_members.user_id unique constraint
    if (table === "team_members") {
      const existing = this.tables
        .get("team_members")!
        .find((r) => r.user_id === row.user_id && r.team_id === row.team_id);
      if (existing) {
        throw new Error("duplicate key value violates unique constraint");
      }
    }

    // Enforce invites pending unique (team_id, email)
    if (table === "invites" && row.status === "pending") {
      const existing = this.tables
        .get("invites")!
        .find(
          (r) =>
            r.team_id === row.team_id &&
            r.email === row.email &&
            r.status === "pending",
        );
      if (existing) {
        throw new Error("duplicate key value violates unique constraint");
      }
    }

    const id = row.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const withDefaults = {
      ...row,
      id,
      created_at: row.created_at || now,
    };

    this.tables.get(table)!.push(withDefaults);
    return withDefaults;
  }

  select(table: string): QueryBuilder {
    return new QueryBuilder(table, this.tables.get(table) || []);
  }

  from(table: string): QueryBuilder {
    return this.select(table);
  }

  update(table: string, id: string, updates: FakeSupabaseRow): FakeSupabaseRow {
    const rows = this.tables.get(table)!;
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error(`Row not found in ${table} with id ${id}`);
    }
    const updated = {
      ...rows[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    rows[idx] = updated;
    return updated;
  }

  delete(table: string, id: string): void {
    const rows = this.tables.get(table)!;
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error(`Row not found in ${table} with id ${id}`);
    }
    rows.splice(idx, 1);
  }

  clear(table: string): void {
    this.tables.set(table, []);
  }

  getAll(table: string): FakeSupabaseRow[] {
    return this.tables.get(table) || [];
  }
}

class QueryBuilder {
  private table: string;
  private rows: FakeSupabaseRow[];
  private whereConditions: Array<(r: FakeSupabaseRow) => boolean> = [];
  private orderBy?: { column: string; ascending: boolean };
  private limitValue?: number;

  constructor(table: string, rows: FakeSupabaseRow[]) {
    this.table = table;
    this.rows = rows;
  }

  select(): QueryBuilder {
    return this;
  }

  eq(column: string, value: unknown): QueryBuilder {
    this.whereConditions.push((r) => r[column] === value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(n: number): QueryBuilder {
    this.limitValue = n;
    return this;
  }

  maybeSingle(): { data: FakeSupabaseRow | null; error: null } {
    let result = this.rows.filter((r) =>
      this.whereConditions.every((c) => c(r)),
    );

    if (this.orderBy) {
      result.sort((a, b) => {
        const aVal = a[this.orderBy!.column];
        const bVal = b[this.orderBy!.column];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return this.orderBy!.ascending ? cmp : -cmp;
      });
    }

    if (this.limitValue) {
      result = result.slice(0, this.limitValue);
    }

    return { data: result[0] || null, error: null };
  }

  single(): { data: FakeSupabaseRow; error: null } {
    const result = this.maybeSingle();
    if (!result.data) {
      throw new Error(`No row found in ${this.table}`);
    }
    return { data: result.data, error: null };
  }

  insert(): { error: null } {
    // Caller handles insert logic; we just validate here
    return { error: null };
  }

  update(): QueryBuilder {
    // Marked for update; caller will call eq() then finalize
    return this;
  }

  delete(): QueryBuilder {
    return this;
  }
}

export class FakeSupabaseClient {
  private db: FakeDatabase;
  private currentUser: FakeAuthUser | null = null;
  public callLog: { method: string; args: unknown[] }[] = [];
  private linkCounter = 0;

  constructor(db: FakeDatabase) {
    this.db = db;
  }

  private recordCall(method: string, args: unknown[]) {
    this.callLog.push({ method, args });
  }

  from(table: string) {
    return {
      select: (columns?: string) => this.db.from(table).select(columns),
      insert: (row: FakeSupabaseRow) => {
        try {
          const inserted = this.db.insert(table, row);
          return { data: inserted, error: null };
        } catch (e: unknown) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      },
      update: (updates: FakeSupabaseRow) => ({
        eq: (column: string, value: unknown) => ({
          data: this.db.update(table, value as string, updates),
          error: null,
        }),
      }),
      delete: () => ({
        eq: (column: string, value: unknown) => {
          try {
            this.db.delete(table, value as string);
            return { data: null, error: null };
          } catch (e: unknown) {
            return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
          }
        },
      }),
    };
  }

  auth = {
    getUser: async () => ({ data: { user: this.currentUser }, error: null }),
    setUser: (user: FakeAuthUser) => {
      this.currentUser = user;
    },
    admin: {
      inviteUserByEmail: async (email: string) => {
        this.recordCall('inviteUserByEmail', [email]);
        const existingInvites = this.db
          .getAll("invites")
          .filter((inv) => inv.email?.toLowerCase() === email.toLowerCase());
        if (existingInvites.some((inv) => inv.status === "pending")) {
          return {
            data: null,
            error: { message: "User already registered" },
          };
        }
        const userId = crypto.randomUUID();
        return {
          data: { user: { id: userId, email } },
          error: null,
        };
      },
      listUsers: async () => {
        this.recordCall('listUsers', []);
        return {
          data: {
            users: [
              { id: "invited-user-1", email: "invited@example.com" },
            ],
          },
          error: null,
        };
      },
      generateLink: async (options?: unknown) => {
        this.recordCall('generateLink', [options]);
        const fakeLink = `https://example.com/auth/callback?token_hash=fake-${this.linkCounter++}&type=${options?.type || 'magiclink'}`;
        return {
          data: {
            properties: { action_link: fakeLink },
            user: { id: "invited-user-1", email: options?.email || "invited@example.com" },
          },
          error: null,
        };
      },
    },
    resetPasswordForEmail: async (email: string) => {
      this.recordCall('resetPasswordForEmail', [email]);
      return {
        data: null,
        error: null,
      };
    },
  };
}

export interface EmailSendRecord {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export function createFakeSupabaseSetup() {
  const db = new FakeDatabase();
  const client = new FakeSupabaseClient(db);
  const emailLog: EmailSendRecord[] = [];
  return { db, client, emailLog };
}
