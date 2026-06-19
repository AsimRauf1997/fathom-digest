// In-memory fake of the lib/db `db` export, driven by fake-schema.ts's column
// descriptors and fake-drizzle-orm.ts's `eq`/`and`/`desc` condition objects.
// Good enough to exercise the real server action logic without Postgres;
// note `transaction()` does NOT roll back on throw (in-memory only), so the
// last-admin-invariant tests rely on the actions checking before mutating.

import type { FakeCondition, FakeOrder } from "./fake-drizzle-orm";

export type FakeRow = Record<string, unknown>;
export type FakeTableRef = { _table: string };

function matches(row: FakeRow, cond: FakeCondition | undefined): boolean {
  if (!cond) return true;
  if (cond.type === "eq") return row[cond.column._field] === cond.value;
  if (cond.type === "and") return cond.conds.every((c) => matches(row, c));
  return false;
}

function applyOrder(rows: FakeRow[], orderBy: FakeOrder[] | undefined): FakeRow[] {
  if (!orderBy?.length) return rows;
  const sorted = [...rows];
  for (const ord of orderBy) {
    const field = ord.column._field;
    sorted.sort((a, b) => {
      const av = a[field] as string | number | Date;
      const bv = b[field] as string | number | Date;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return ord.type === "desc" ? -cmp : cmp;
    });
  }
  return sorted;
}

function pick(row: FakeRow, columns?: Record<string, boolean>): FakeRow {
  if (!columns) return { ...row };
  const out: FakeRow = {};
  for (const key of Object.keys(columns)) {
    if (columns[key]) out[key] = row[key];
  }
  return out;
}

export interface FakeDb {
  query: {
    teams: QueryHandle;
    teamMembers: QueryHandle;
    invites: QueryHandle;
    users: QueryHandle;
  };
  insert(table: FakeTableRef): InsertBuilder;
  update(table: FakeTableRef): UpdateBuilder;
  delete(table: FakeTableRef): DeleteBuilder;
  transaction<T>(cb: (tx: FakeDb) => Promise<T>): Promise<T>;
  _data: Record<string, FakeRow[]>;
}

interface QueryHandle {
  findFirst(opts?: {
    where?: FakeCondition;
    orderBy?: FakeOrder[];
    columns?: Record<string, boolean>;
  }): Promise<FakeRow | undefined>;
  findMany(opts?: {
    where?: FakeCondition;
    orderBy?: FakeOrder[];
    columns?: Record<string, boolean>;
  }): Promise<FakeRow[]>;
}

interface InsertBuilder {
  values(value: FakeRow): {
    returning(columns?: Record<string, boolean>): Promise<FakeRow[]>;
    onConflictDoUpdate(opts: {
      target: unknown;
      set: FakeRow;
    }): { returning(columns?: Record<string, boolean>): Promise<FakeRow[]> };
    then: Promise<void>["then"];
  };
}

interface UpdateBuilder {
  set(values: FakeRow): { where(cond: FakeCondition): Promise<void> };
}

interface DeleteBuilder {
  where(cond: FakeCondition): Promise<void>;
}

export function createFakeDb(): FakeDb {
  const data: Record<string, FakeRow[]> = {
    teams: [],
    teamMembers: [],
    invites: [],
    users: [],
  };

  function makeQueryHandle(tableName: string): QueryHandle {
    return {
      async findFirst(opts = {}) {
        const rows = applyOrder(
          data[tableName].filter((r) => matches(r, opts.where)),
          opts.orderBy,
        );
        return rows[0] ? pick(rows[0], opts.columns) : undefined;
      },
      async findMany(opts = {}) {
        const rows = applyOrder(
          data[tableName].filter((r) => matches(r, opts.where)),
          opts.orderBy,
        );
        return rows.map((r) => pick(r, opts.columns));
      },
    };
  }

  const db: FakeDb = {
    query: {
      teams: makeQueryHandle("teams"),
      teamMembers: makeQueryHandle("teamMembers"),
      invites: makeQueryHandle("invites"),
      users: makeQueryHandle("users"),
    },
    insert(table) {
      const tableName = table._table;
      return {
        values(value) {
          const row: FakeRow = {
            id: (value.id as string) ?? crypto.randomUUID(),
            createdAt: value.createdAt ?? new Date(),
            ...value,
          };
          data[tableName].push(row);
          return {
            async returning(columns) {
              return [pick(row, columns)];
            },
            onConflictDoUpdate(opts) {
              // Remove the row we just added (we'll add it back or update an existing one)
              data[tableName] = data[tableName].filter((r) => r.id !== row.id);

              const existing = data[tableName].find((r) => r.id === row.id);
              let finalRow: FakeRow;

              if (existing) {
                // Update existing row
                Object.assign(existing, opts.set);
                finalRow = existing;
              } else {
                // Insert new row
                finalRow = row;
                data[tableName].push(row);
              }

              return {
                async returning(columns) {
                  return [pick(finalRow, columns)];
                },
              };
            },
            then(onFulfilled, onRejected) {
              return Promise.resolve().then(onFulfilled, onRejected);
            },
          };
        },
      };
    },
    update(table) {
      const tableName = table._table;
      return {
        set(values) {
          return {
            async where(cond) {
              data[tableName] = data[tableName].map((r) =>
                matches(r, cond) ? { ...r, ...values } : r,
              );
            },
          };
        },
      };
    },
    delete(table) {
      const tableName = table._table;
      return {
        async where(cond) {
          data[tableName] = data[tableName].filter((r) => !matches(r, cond));
        },
      };
    },
    async transaction(cb) {
      return cb(db);
    },
    _data: data,
  };

  return db;
}
