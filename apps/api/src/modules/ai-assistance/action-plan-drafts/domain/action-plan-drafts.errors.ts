import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 계획은 서버 정규화가 상한대로 자른 값이다. 어긋나면 정규화 코드의 버그라 500이다 */
export function invalidActionPlanDraft(reason: string): DomainException {
  return new DomainException(ErrorCode.SYS_0001, { reason });
}
