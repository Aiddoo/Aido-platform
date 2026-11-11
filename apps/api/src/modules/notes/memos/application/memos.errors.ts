import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { MemoId } from "../domain/memo-id.vo.js";

export function memoNotFound(memoId: MemoId): ApplicationException {
  return new ApplicationException(ErrorCode.MEMO_2001, { memoId: memoId.value });
}

export function reorderTargetNotFound(targetMemoId: MemoId): ApplicationException {
  return new ApplicationException(ErrorCode.MEMO_2002, { targetMemoId: targetMemoId.value });
}

export function memoLimitReached(currentCount: number): ApplicationException {
  return new ApplicationException(ErrorCode.MEMO_2003, {
    current: currentCount,
    limit: MEMO_LIMITS.MAX_PER_USER,
  });
}
