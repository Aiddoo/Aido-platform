import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccountProvider, OAuthMode } from "../../domain/auth.constants.js";

/** 공급자 토큰을 검증해 얻은 프로필. 공급자 응답 모양은 어댑터의 wire schema가 안다 */
export interface VerifiedProfile {
  id: string;
  email?: string | null;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface GenerateAuthUrlParams {
  state: string;
  validatedRedirectUri: string;
  mode?: OAuthMode;
  initiatingUserId?: UserId;
  persistState: (
    provider: AccountProvider,
    redirectUri: string,
    opts: { mode?: OAuthMode; initiatingUserId?: UserId },
  ) => Promise<unknown>;
}

export interface ExchangedToken {
  token: string;
}

export interface SocialLoginOptions {
  userName?: string;
  emailVerified: boolean;
  profileImage?: string;
}

/** 공급자 하나의 웹 인가 URL·코드 교환·토큰 검증. 공급자 이름과 응답 모양은 어댑터에만 둔다 */
export abstract class OAuthIdentityProviderPort {
  abstract readonly provider: AccountProvider;
  /** 토큰 검증이 실패해 사용자를 알 수 없을 때 LoginAttempt에 남길 이메일 */
  abstract readonly failureEmail: string;
  /** 웹 인가 흐름이 없는 공급자(Apple)는 null이다 */
  abstract generateAuthUrl(params: GenerateAuthUrlParams): Promise<string | null>;
  /** 웹 인가 흐름이 없는 공급자(Apple)는 null이다. 받은 token은 verifyToken에 그대로 넘긴다 */
  abstract exchangeCode(code: string, state?: string): Promise<ExchangedToken | null>;
  abstract verifyToken(token: string, nonce?: string): Promise<VerifiedProfile>;
  abstract buildLoginOptions(
    verifiedProfile: VerifiedProfile,
    userName?: string,
  ): SocialLoginOptions;
}

export abstract class OAuthIdentityProviderRegistryPort {
  abstract get(provider: AccountProvider): OAuthIdentityProviderPort | undefined;
}
