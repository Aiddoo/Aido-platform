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

/** 메모 변환이 같은 트랜잭션에서 만든 할 일을 받지 못했다(생기면 버그다) */
export function stagedTodoMissing(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, {
    detail: "Staged todo creation returned no todo",
  });
}

/** 같은 Idempotency-Key로 내용이 다른 메모를 다시 보냈다 */
export function memoRequestMismatch(): ApplicationException {
  return new ApplicationException(ErrorCode.MEMO_2004);
}

/**
 * 같은 사용자의 같은 Idempotency-Key로 저장된 메모가 이미 있다. 사용자 순서 잠금을 지나 겹친 생성을 저장소가
 * unique 제약으로 알린다. HTTP로 나가지 않고 CreateMemoUseCase가 받아 먼저 저장된 메모를 돌려준다
 */
export class MemoIdempotencyKeyTakenError extends Error {
  constructor() {
    super("Memo idempotency key already taken");
    this.name = "MemoIdempotencyKeyTakenError";
  }
}
