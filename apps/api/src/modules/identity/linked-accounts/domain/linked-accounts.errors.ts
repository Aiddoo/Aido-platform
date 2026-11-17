import { ErrorCode } from "@aido/api/errors";
import { match } from "ts-pattern";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import type { AccountProvider } from "./linked-accounts.constants.js";

export function lastLoginMethodRequired(): DomainException {
  return new DomainException(ErrorCode.USER_0610);
}

/** 공급자 계정이 이미 누군가에게 연결됐거나 이 사용자에게 같은 공급자의 다른 계정이 있으면 출시 앱이 아는 공급자별 코드다 */
export function oauthAccountAlreadyLinked(
  provider: AccountProvider,
  providerAccountId: string,
): DomainException {
  return match(provider)
    .with("KAKAO", () => new DomainException(ErrorCode.KAKAO_0306, { kakaoId: providerAccountId }))
    .with("APPLE", () => new DomainException(ErrorCode.APPLE_0355, { appleId: providerAccountId }))
    .with(
      "GOOGLE",
      () => new DomainException(ErrorCode.GOOGLE_0405, { googleId: providerAccountId }),
    )
    .with("NAVER", () => new DomainException(ErrorCode.NAVER_0455, { naverId: providerAccountId }))
    .with(
      "CREDENTIAL",
      () => new DomainException(ErrorCode.USER_0604, { provider, providerAccountId }),
    )
    .exhaustive();
}

export function socialAccountPasswordUnchangeable(userId: string): DomainException {
  return new DomainException(ErrorCode.USER_0613, { userId });
}
