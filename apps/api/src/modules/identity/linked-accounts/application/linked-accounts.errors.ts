import { ErrorCode } from "@aido/api/errors";
import { match } from "ts-pattern";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { AccountProvider } from "../domain/linked-accounts.constants.js";

export function accountAlreadyExists(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0604);
}

/** 공급자 계정이 이미 어떤 사용자에게 연결돼 있으면 출시 앱이 아는 공급자별 코드다 */
export function oauthAccountAlreadyLinked(
  provider: AccountProvider,
  providerAccountId: string,
): ApplicationException {
  return match(provider)
    .with(
      "KAKAO",
      () => new ApplicationException(ErrorCode.KAKAO_0306, { kakaoId: providerAccountId }),
    )
    .with(
      "APPLE",
      () => new ApplicationException(ErrorCode.APPLE_0355, { appleId: providerAccountId }),
    )
    .with(
      "GOOGLE",
      () => new ApplicationException(ErrorCode.GOOGLE_0405, { googleId: providerAccountId }),
    )
    .with(
      "NAVER",
      () => new ApplicationException(ErrorCode.NAVER_0455, { naverId: providerAccountId }),
    )
    .with(
      "CREDENTIAL",
      () => new ApplicationException(ErrorCode.USER_0604, { provider, providerAccountId }),
    )
    .exhaustive();
}

export function socialAccountPasswordUnchangeable(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0613, { userId });
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
