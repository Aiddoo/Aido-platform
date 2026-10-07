import type { Memo as MemoResponse } from "@aido/api";

import { toISOString } from "#api/shared/domain/date/utils/format";

import type { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";

export function toMemoView(memo: Memo): MemoResponse {
  const snapshot = memo.snapshot;
  return {
    ...snapshot,
    createdAt: toISOString(snapshot.createdAt),
    updatedAt: toISOString(snapshot.updatedAt),
  };
}
