import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccountProvider } from "../../../linked-accounts/domain/linked-accounts.constants.js";
import type { ProviderAccountId } from "../../../linked-accounts/domain/provider-account-id.vo.js";
import type { OAuthStateId } from "../../domain/oauth-state-id.vo.js";
import type { OAuthState } from "../../domain/oauth-state.aggregate.js";
import type { OAuthMode } from "../../domain/oauth-states.constants.js";

export interface NewOAuthState {
  readonly state: string;
  readonly provider: AccountProvider;
  readonly redirectUri: string;
  readonly mode?: OAuthMode;
  readonly initiatingUserId?: UserId;
  readonly expiresAt: Temporal.Instant;
}

export interface OAuthLoginExchangeData {
  readonly exchangeCode: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
  readonly userName?: string;
  readonly profileImage?: string;
  readonly accountRestored?: boolean;
  readonly isNewUser: boolean;
}

export interface OAuthLinkingData {
  readonly exchangeCode: string;
  readonly provider: AccountProvider;
  readonly providerAccountId: ProviderAccountId;
}

export abstract class OAuthStateRepositoryPort {
  abstract create(input: NewOAuthState): Promise<void>;
  /** 만료 전 state. 교환을 마쳤어도 준다(콜백 리다이렉트 주소를 찾을 때 쓴다) */
  abstract findByState(state: string, now: Temporal.Instant): Promise<OAuthState | null>;
  /** 교환하지 않았고 만료 전인 교환 코드. 저장한 토큰은 평문으로 돌려준다 */
  abstract findByExchangeCode(
    exchangeCode: string,
    now: Temporal.Instant,
  ): Promise<OAuthState | null>;
  abstract saveExchangeData(
    oauthStateId: OAuthStateId,
    data: OAuthLoginExchangeData,
  ): Promise<void>;
  abstract saveLinkingData(oauthStateId: OAuthStateId, data: OAuthLinkingData): Promise<void>;
  /** 교환(consume)한 state를 저장한다. 그 사이 다른 요청이 교환했거나 만료·코드가 바뀌었으면 false다 */
  abstract save(state: OAuthState): Promise<boolean>;
  abstract generateExchangeCode(): string;
  abstract deleteExpiredBefore(cutoff: Temporal.Instant, limit: number): Promise<number>;
}
