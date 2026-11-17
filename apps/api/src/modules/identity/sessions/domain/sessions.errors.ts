import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function revokedSessionNotRotatable(sessionId: string): DomainException {
  return new DomainException(ErrorCode.SESSION_0703, { sessionId, reason: undefined });
}

export function expiredSessionNotRotatable(sessionId: string): DomainException {
  return new DomainException(ErrorCode.SESSION_0702, { sessionId });
}
