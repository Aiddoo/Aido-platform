import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { AccountProvider } from "../../linked-accounts/domain/linked-accounts.constants.js";
import { isExpiredAt } from "../../shared/domain/expiry.domain-service.js";
import { OAuthStateId } from "./oauth-state-id.vo.js";
import {
  OAUTH_STATE_EXPIRY_MINUTES,
  type OAUTH_STATE_VALIDITIES,
  type OAuthMode,
} from "./oauth-states.constants.js";

export interface OAuthStatePrimitives {
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

interface OAuthStateProps {
  state: string;
  provider: AccountProvider;
  redirectUri: string;
  mode: string | null;
  initiatingUserId: string | null;
  exchangeCode: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userName: string | null;
  profileImage: string | null;
  accountRestored: boolean | null;
  isNewUser: boolean | null;
  expiresAt: Temporal.Instant;
  exchangedAt: Temporal.Instant | null;
}

export type OAuthStateValidity = (typeof OAUTH_STATE_VALIDITIES)[number];

/** 앱 로그인 토큰을 넘기는 일회용 교환 코드. 웹 OAuth 콜백이 저장하고 앱이 한 번 교환한다 */
export interface OAuthLoginExchange {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
}

/** 웹 OAuth 흐름의 CSRF state와, 콜백 뒤 앱에 넘길 일회용 교환 결과 */
export class OAuthState extends AggregateRoot<OAuthStateId, OAuthStateProps> {
  // 웹 OAuth 시작이 만든다. 콜백이 교환 결과를 채우기 전까지 토큰·교환 칸은 비어 있다
  static create(params: {
    readonly id: OAuthStateId;
    readonly state: string;
    readonly provider: AccountProvider;
    readonly redirectUri: string;
    readonly mode: OAuthMode | null;
    readonly initiatingUserId: UserId | null;
    readonly now: Temporal.Instant;
  }): OAuthState {
    return new OAuthState(params.id, {
      state: params.state,
      provider: params.provider,
      redirectUri: params.redirectUri,
      mode: params.mode,
      initiatingUserId: params.initiatingUserId?.value ?? null,
      exchangeCode: null,
      accessToken: null,
      refreshToken: null,
      userId: null,
      userName: null,
      profileImage: null,
      accountRestored: null,
      isNewUser: null,
      expiresAt: params.now.add({ minutes: OAUTH_STATE_EXPIRY_MINUTES }),
      exchangedAt: null,
    });
  }

  static reconstitute(primitives: OAuthStatePrimitives): OAuthState {
    const { id, ...props } = primitives;
    const oauthState = new OAuthState(OAuthStateId.reconstitute(id), { ...props });
    oauthState.#isPersisted = true;
    return oauthState;
  }

  // 저장소가 새 state를 넣을지, 읽은 state의 교환만 쓸지 가르는 기준이다
  #isPersisted = false;

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

  get exchangedAt(): Temporal.Instant | null {
    return this.props.exchangedAt;
  }

  isPersisted(): boolean {
    return this.#isPersisted;
  }

  // 저장소가 넣은 뒤 부른다. 같은 객체를 다시 save하면 또 넣지 않고 교환만 쓴다
  markPersisted(): void {
    this.#isPersisted = true;
  }

  // 옛 교환 행은 값이 없어(null) 호출자가 기본값을 정한다
  isNewUser(): boolean | null {
    return this.props.isNewUser;
  }

  validityAt(now: Temporal.Instant): OAuthStateValidity {
    if (this.props.exchangedAt != null) {
      return "exchanged";
    }
    return isExpiredAt(this.props.expiresAt, now) ? "expired" : "valid";
  }

  // 1.15.0 이하 앱은 연결 시작에 user_hint를 보내지 않아 시작한 사용자가 비어 있다. 1.17.0 확인 뒤 지운다(compatibility.md)
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

  // 교환한 뒤에는 저장한 토큰을 남기지 않는다
  consume(now: Temporal.Instant): boolean {
    if (this.validityAt(now) !== "valid") {
      return false;
    }
    this.props.exchangedAt = now;
    this.props.accessToken = null;
    this.props.refreshToken = null;
    return true;
  }

  toPrimitives(): OAuthStatePrimitives {
    return { id: this.id.value, ...this.props };
  }
}
