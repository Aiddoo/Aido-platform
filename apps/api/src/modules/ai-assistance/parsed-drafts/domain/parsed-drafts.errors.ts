import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/**
 * 정규화한 초안은 서버가 상한대로 자른 값이다. 어긋나면 정규화 코드의 버그라 500 코드지만, 과금 생성 안에서
 * 던지므로 예약을 환불하고 AI_1302로 답한다
 */
export function invalidParsedDraft(reason: string): DomainException {
  return new DomainException(ErrorCode.SYS_0001, { reason });
}
