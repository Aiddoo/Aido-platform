import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { AUTH_DEFAULTS, type DeviceFingerprint } from "./auth.constants.js";
import { SessionId } from "./session-id.vo.js";
import { getSessionValidity, type SessionValidity } from "./session-validity.domain-service.js";

export interface AuthSessionPrimitives {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly previousTokenHash: string | null;
  readonly tokenFamily: string;
  readonly tokenVersion: number;
  readonly deviceFingerprint: DeviceFingerprint;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly lastUsedAt: Temporal.Instant;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
  readonly revokedAt: Temporal.Instant | null;
}

type AuthSessionProps = Omit<AuthSessionPrimitives, "id" | "userId"> & {
  readonly userId: UserId;
};

/** refresh 토큰 회전 계획. 저장소가 expectedTokenVersion을 조건으로 원자적으로 바꾼다 */
export interface AuthSessionRotation {
  readonly refreshTokenHash: string;
  readonly tokenVersion: number;
  readonly previousTokenHash: string;
  readonly expectedTokenVersion: number;
  readonly expiresAt: Temporal.Instant;
}

/** refresh 토큰 회전·재사용 탐지·소유 규칙을 가진 로그인 세션 */
export class AuthSession extends AggregateRoot<SessionId, AuthSessionProps> {
  // refresh 토큰이 세션 id를 담아 id를 먼저 받고 발급한 토큰의 hash로 만든다
  static create(params: {
    readonly id: SessionId;
    readonly userId: string;
    readonly refreshTokenHash: string;
    readonly tokenFamily: string;
    readonly deviceFingerprint: DeviceFingerprint;
    readonly userAgent: string;
    readonly ipAddress: string;
    readonly expiresAt: Temporal.Instant;
    readonly now: Temporal.Instant;
  }): AuthSession {
    return new AuthSession(params.id, {
      userId: UserId.reconstitute(params.userId),
      refreshTokenHash: params.refreshTokenHash,
      previousTokenHash: null,
      tokenFamily: params.tokenFamily,
      tokenVersion: 1,
      deviceFingerprint: params.deviceFingerprint.substring(
        0,
        AUTH_DEFAULTS.MAX_DEVICE_FINGERPRINT_LENGTH,
      ),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      lastUsedAt: params.now,
      createdAt: params.now,
      updatedAt: params.now,
      expiresAt: params.expiresAt,
      revokedAt: null,
    });
  }

  static reconstitute(primitives: AuthSessionPrimitives): AuthSession {
    const { id, userId, ...props } = primitives;
    return new AuthSession(SessionId.reconstitute(id), {
      ...props,
      userId: UserId.reconstitute(userId),
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get refreshTokenHash(): string {
    return this.props.refreshTokenHash;
  }

  get tokenFamily(): string {
    return this.props.tokenFamily;
  }

  get tokenVersion(): number {
    return this.props.tokenVersion;
  }

  get expiresAt(): Temporal.Instant {
    return this.props.expiresAt;
  }

  get revokedAt(): Temporal.Instant | null {
    return this.props.revokedAt;
  }

  get ipAddress(): string {
    return this.props.ipAddress;
  }

  get userAgent(): string {
    return this.props.userAgent;
  }

  get lastUsedAt(): Temporal.Instant {
    return this.props.lastUsedAt;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  isOwnedBy(userId: UserId): boolean {
    return this.props.userId.equals(userId);
  }

  isRevoked(): boolean {
    return this.props.revokedAt != null;
  }

  validityAt(now: Temporal.Instant): SessionValidity {
    return getSessionValidity({
      expiresAt: this.props.expiresAt,
      revokedAt: this.props.revokedAt,
      now,
    });
  }

  wasPreviouslyIssued(refreshTokenHash: string): boolean {
    return this.props.previousTokenHash === refreshTokenHash;
  }

  // 직전 토큰이 grace 안에 다시 오면 응답을 못 받은 앱의 재시도로 본다
  isRetryWithin(refreshTokenHash: string, now: Temporal.Instant, gracePeriodMs: number): boolean {
    if (!this.wasPreviouslyIssued(refreshTokenHash)) {
      return false;
    }
    const elapsedMs = now.since(this.props.lastUsedAt).total("milliseconds");
    return elapsedMs <= gracePeriodMs;
  }

  // 현재 hash를 직전 hash로 남겨야 같은 옛 토큰의 재시도를 한 번만 허용한다
  planRotation(refreshTokenHash: string, expiresAt: Temporal.Instant): AuthSessionRotation {
    return {
      refreshTokenHash,
      tokenVersion: this.props.tokenVersion + 1,
      previousTokenHash: this.props.refreshTokenHash,
      expectedTokenVersion: this.props.tokenVersion,
      expiresAt,
    };
  }

  toPrimitives(): AuthSessionPrimitives {
    return { id: this.id.value, ...this.props, userId: this.props.userId.value };
  }
}
