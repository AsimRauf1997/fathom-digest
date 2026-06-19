// Minimal stand-in for the subset of drizzle-orm used by action code
// (`eq`, `and`, `desc`), paired with fake-db.ts's condition evaluator.

import type { FakeColumn } from "./fake-schema";

export type FakeCondition =
  | { type: "eq"; column: FakeColumn; value: unknown }
  | { type: "and"; conds: FakeCondition[] };

export type FakeOrder = { type: "desc"; column: FakeColumn };

export function eq(column: FakeColumn, value: unknown): FakeCondition {
  return { type: "eq", column, value };
}

export function and(...conds: FakeCondition[]): FakeCondition {
  return { type: "and", conds };
}

export function desc(column: FakeColumn): FakeOrder {
  return { type: "desc", column };
}
