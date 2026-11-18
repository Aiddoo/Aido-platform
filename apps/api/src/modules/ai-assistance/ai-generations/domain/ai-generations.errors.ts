import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 생성 결과는 서버 체인이 만든 값이다. 어긋나면 체인 코드의 버그라 500이다 */
export function invalidAiGeneration(reason: string): DomainException {
  return new DomainException(ErrorCode.SYS_0001, { reason });
}
