import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { AccountProvider } from "../domain/linked-accounts.constants.js";

export function accountAlreadyExists(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0604);
}

export function linkedAccountNotFound(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0603, { provider: undefined });
}

export function passwordAlreadySet(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0614, { userId });
}

export function unsupportedOAuthProvider(provider: string): ApplicationException {
  return new ApplicationException(ErrorCode.SOCIAL_0204, {
    provider,
    reason: `Unsupported provider: ${provider}`,
  });
}

export function invalidSocialToken(provider: AccountProvider): ApplicationException {
  return new ApplicationException(ErrorCode.SOCIAL_0202, { provider });
}

export function expiredSocialToken(provider: AccountProvider): ApplicationException {
  return new ApplicationException(ErrorCode.SOCIAL_0203, { provider });
}
