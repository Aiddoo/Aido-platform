import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { AccountProvider, AUTH_OAUTH_STATE_VALIDITIES } from "./auth.constants.js";
import { OAuthStateId } from "./oauth-state-id.vo.js";

export interface AuthOAuthStatePrimitives {
  readonly id: number;
  readonly state: string;
  readonly provider: AccountProvider;
  readonly redirectUri: string;
  readonly mode: string | null;
  readonly initiatingUserId: string | null;
  readonly exchangeCode: string | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly userId: string | null;
  readonly userName: string | null;
  readonly profileImage: string | null;
  readonly accountRestored: boolean | null;
  readonly isNewUser: boolean | null;
  readonly expiresAt: Temporal.Instant;
  readonly exchangedAt: Temporal.Instant | null;
}

type AuthOAuthStateProps = Omit<
  { -readonly [K in keyof AuthOAuthStatePrimitives]: AuthOAuthStatePrimitives[K] },
  "id"
>;

export type AuthOAuthStateValidity = (typeof AUTH_OAUTH_STATE_VALIDITIES)[number];

/** 앱 로그인 토큰을 넘기는 일회용 교환 코드. 웹 OAuth 콜백이 저장하고 앱이 한 번 교환한다 */
export interface OAuthLoginExchange {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
}

/** 웹 OAuth 흐름의 CSRF state와, 콜백 뒤 앱에 넘길 일회용 교환 결과 */
export class AuthOAuthState extends AggregateRoot<OAuthStateId, AuthOAuthStateProps> {
  static reconstitute(primitives: AuthOAuthStatePrimitives): AuthOAuthState {
    const { id, ...props } = primitives;
    return new AuthOAuthState(OAuthStateId.reconstitute(id), { ...props });
  }

  get state(): string {
    return this.props.state;
  }

  get provider(): AccountProvider {
    return this.props.provider;
  }

  get redirectUri(): string {
    return this.props.redirectUri;
  }

  get mode(): string | null {
    return this.props.mode;
  }

  get initiatingUserId(): string | null {
    return this.props.initiatingUserId;
  }

  get userName(): string | null {
    return this.props.userName;
  }

  get profileImage(): string | null {
    return this.props.profileImage;
  }

  get accountRestored(): boolean | null {
    return this.props.accountRestored;
  }

  get isNewUser(): boolean | null {
    return this.props.isNewUser;
  }

  get exchangedAt(): Temporal.Instant | null {
    return this.props.exchangedAt;
  }

  validityAt(now: Temporal.Instant): AuthOAuthStateValidity {
    if (this.props.exchangedAt != null) {
      return "exchanged";
    }
    return Temporal.Instant.compare(this.props.expiresAt, now) <= 0 ? "expired" : "valid";
  }

  // 1.15.0까지의 앱은 연결 시작에 user_hint를 보내지 않아 시작한 사용자가 비어 있다. 모든 지원 앱이 보내면 지운다
  canLinkFor(userId: string): boolean {
    return (
      this.props.mode === "link" &&
      (this.props.initiatingUserId == null ||
        this.props.initiatingUserId === "" ||
        this.props.initiatingUserId === userId)
    );
  }

  /** 로그인 교환에 필요한 토큰이 모두 저장돼 있을 때만 돌려준다 */
  loginExchange(): OAuthLoginExchange | null {
    const { accessToken, refreshToken, userId } = this.props;
    if (!accessToken || !refreshToken || !userId) {
      return null;
    }
    return { accessToken, refreshToken, userId };
  }

  /** 연결 교환은 공급자 계정 id를 userId 칸에 저장해 왔다 */
  linkedProviderAccountId(): string | null {
    return this.props.userId ? this.props.userId : null;
  }

  consume(now: Temporal.Instant): boolean {
    if (this.validityAt(now) !== "valid") {
      return false;
    }
    this.props.exchangedAt = now;
    return true;
  }

  toPrimitives(): AuthOAuthStatePrimitives {
    return { id: this.id.value, ...this.props };
  }
}
