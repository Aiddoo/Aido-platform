import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function invalidEmail(value: string): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { email: value });
}

export function linkedAccountNotFound(): DomainException {
  return new DomainException(ErrorCode.USER_0603, { provider: undefined });
}

export function lastLoginMethodRequired(): DomainException {
  return new DomainException(ErrorCode.USER_0610);
}
