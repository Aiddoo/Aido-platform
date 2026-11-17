import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function suggestionAlreadyHandled(
  suggestionId: number,
  currentStatus: string,
): DomainException {
  return new DomainException(ErrorCode.AI_1306, { suggestionId, currentStatus });
}

export function suggestionExpired(suggestionId: number): DomainException {
  return new DomainException(ErrorCode.AI_1307, { suggestionId });
}

/** 근거는 서버가 기록에서 센 값이다. 어긋나면 집계 코드의 버그라 500이다 */
export function invalidSuggestionEvidence(evidence: {
  readonly recordedCount: number;
  readonly completedCount: number;
  readonly periodDays: number;
}): DomainException {
  return new DomainException(ErrorCode.SYS_0001, {
    reason: "suggestion evidence must have records and completedCount within recordedCount",
    ...evidence,
  });
}
