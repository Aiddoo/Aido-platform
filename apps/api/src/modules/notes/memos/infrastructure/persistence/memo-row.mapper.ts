import type { memo as memoTable } from "#api/platform/database/schema/notes.schema";

import { Memo } from "../../domain/memo.aggregate.js";

type MemoRow = typeof memoTable.$inferSelect;
type MemoInsertRow = typeof memoTable.$inferInsert;

export function toMemo(row: MemoRow): Memo {
  return Memo.reconstitute(row);
}

export function toMemoRow(memo: Memo): MemoInsertRow {
  return memo.toPrimitives();
}
