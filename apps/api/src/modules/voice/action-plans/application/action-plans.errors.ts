import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

/** 같은 Idempotency-Key로 내용이 다른 계획을 다시 보냈다 */
export function planRequestMismatch(): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1318, { charged: false });
}

/** 같은 Idempotency-Key의 다른 요청이 먼저 적용 기록을 남겼다 */
export function planApplicationInProgress(): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1314, { charged: false });
}

export function sourceMemoNotFound(memoId: number): ApplicationException {
  return new ApplicationException(ErrorCode.MEMO_2001, { memoId });
}
