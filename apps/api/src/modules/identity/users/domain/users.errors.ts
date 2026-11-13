import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function accountLocked(email: string): DomainException {
  return new DomainException(ErrorCode.USER_0607, { email, remainingMinutes: undefined });
}

export function accountSuspended(userId: string): DomainException {
  return new DomainException(ErrorCode.USER_0605, { userId });
}

export function accountDeleted(userId: string): DomainException {
  return new DomainException(ErrorCode.USER_0606, { userId });
}
