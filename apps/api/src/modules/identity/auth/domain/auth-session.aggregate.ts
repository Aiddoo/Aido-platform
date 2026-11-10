import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { SessionId } from "./session-id.vo.js";
import { getSessionValidity, type SessionValidity } from "./session-validity.domain-service.js";

export interface AuthSessionPrimitives {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly previousTokenHash: string | null;
  readonly tokenFamily: string;
  readonly tokenVersion: number;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly lastUsedAt: Temporal.Instant;
  readonly createdAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
  readonly revokedAt: Temporal.Instant | null;
}

interface AuthSessionProps {
  readonly userId: UserId;
  readonly refreshTokenHash: string;
  readonly previousTokenHash: string | null;
  readonly tokenFamily: string;
  readonly tokenVersion: number;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly lastUsedAt: Temporal.Instant;
  readonly createdAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
  readonly revokedAt: Temporal.Instant | null;
}

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
  static reconstitute(primitives: AuthSessionPrimitives): AuthSession {
    return new AuthSession(SessionId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      refreshTokenHash: primitives.refreshTokenHash,
      previousTokenHash: primitives.previousTokenHash,
      tokenFamily: primitives.tokenFamily,
      tokenVersion: primitives.tokenVersion,
      ipAddress: primitives.ipAddress,
      userAgent: primitives.userAgent,
      lastUsedAt: primitives.lastUsedAt,
      createdAt: primitives.createdAt,
      expiresAt: primitives.expiresAt,
      revokedAt: primitives.revokedAt,
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
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      refreshTokenHash: this.props.refreshTokenHash,
      previousTokenHash: this.props.previousTokenHash,
      tokenFamily: this.props.tokenFamily,
      tokenVersion: this.props.tokenVersion,
      ipAddress: this.props.ipAddress,
      userAgent: this.props.userAgent,
      lastUsedAt: this.props.lastUsedAt,
      createdAt: this.props.createdAt,
      expiresAt: this.props.expiresAt,
      revokedAt: this.props.revokedAt,
    };
  }
}
