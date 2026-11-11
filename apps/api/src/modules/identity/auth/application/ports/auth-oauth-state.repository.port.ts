import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AuthOAuthState } from "../../domain/auth-oauth-state.aggregate.js";
import type { AccountProvider, OAuthMode } from "../../domain/auth.constants.js";
import type { OAuthStateId } from "../../domain/oauth-state-id.vo.js";

export interface NewAuthOAuthState {
  readonly state: string;
  readonly provider: AccountProvider;
  readonly redirectUri: string;
  readonly mode?: OAuthMode;
  readonly initiatingUserId?: UserId;
  readonly expiresAt: Temporal.Instant;
}

export interface AuthOAuthLoginExchangeData {
  readonly exchangeCode: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
  readonly userName?: string;
  readonly profileImage?: string;
  readonly accountRestored?: boolean;
  readonly isNewUser: boolean;
}

export interface AuthOAuthLinkingData {
  readonly exchangeCode: string;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
}

export type ConsumeAuthOAuthStateInput = {
  readonly id: OAuthStateId;
  readonly exchangeCode: string;
  readonly at: Temporal.Instant;
} & ({ readonly purpose: "login" } | { readonly purpose: "link"; readonly actorUserId: UserId });

export abstract class AuthOAuthStateRepositoryPort {
  abstract create(input: NewAuthOAuthState): Promise<void>;
  /** 만료 전 state. 교환을 마쳤어도 준다(콜백 리다이렉트 주소를 찾을 때 쓴다) */
  abstract findByState(state: string, now: Temporal.Instant): Promise<AuthOAuthState | null>;
  /** 교환하지 않았고 만료 전인 교환 코드. 저장한 토큰은 평문으로 돌려준다 */
  abstract findByExchangeCode(
    exchangeCode: string,
    now: Temporal.Instant,
  ): Promise<AuthOAuthState | null>;
  abstract saveExchangeData(
    oauthStateId: OAuthStateId,
    data: AuthOAuthLoginExchangeData,
  ): Promise<void>;
  abstract saveLinkingData(oauthStateId: OAuthStateId, data: AuthOAuthLinkingData): Promise<void>;
  /** 아직 쓸 수 있는 교환 코드만 사용 처리하고 저장한 토큰을 지운다. 경합에 지면 false다 */
  abstract consumeExchangeCode(input: ConsumeAuthOAuthStateInput): Promise<boolean>;
  abstract generateExchangeCode(): string;
}
