import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

export function requirePurchasedAt(
  value: number | undefined,
  eventType: string,
  reason: string,
): Date {
  if (value === undefined || value === 0) {
    throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, { reason, eventType });
  }
  return new Date(value);
}

export function requireExpiresAt(
  value: number | null | undefined,
  eventType: string,
  reason: string,
): Date {
  const expiresAt = optionalExpiresAt(value);
  if (expiresAt === undefined) {
    throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, { reason, eventType });
  }
  return expiresAt;
}

export function optionalExpiresAt(value: number | null | undefined): Date | undefined {
  // 기존 공급자 계약에서 0은 누락된 시각으로 취급한다.
  return value === undefined || value === null || value === 0 ? undefined : new Date(value);
}

export function nullableExpiresAt(value: number | null | undefined): Date | null {
  return optionalExpiresAt(value) ?? null;
}
