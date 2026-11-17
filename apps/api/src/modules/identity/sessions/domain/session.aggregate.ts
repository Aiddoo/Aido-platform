import type { RevokeReason } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { SessionId } from "./session-id.vo.js";
import { getSessionValidity, type SessionValidity } from "./session-validity.domain-service.js";
import { SESSION_DEFAULTS, type DeviceFingerprint } from "./sessions.constants.js";
import { expiredSessionNotRotatable, revokedSessionNotRotatable } from "./sessions.errors.js";

export interface SessionPrimitives {
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
  readonly revokedReason: string | null;
}

interface SessionProps {
  readonly userId: UserId;
  refreshTokenHash: string;
  previousTokenHash: string | null;
  readonly tokenFamily: string;
  tokenVersion: number;
  readonly deviceFingerprint: DeviceFingerprint;
  readonly ipAddress: string;
  readonly userAgent: string;
  lastUsedAt: Temporal.Instant;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
  expiresAt: Temporal.Instant;
  revokedAt: Temporal.Instant | null;
  revokedReason: string | null;
}

/** refresh 토큰 회전·재사용 탐지·소유 규칙을 가진 로그인 세션 */
export class Session extends AggregateRoot<SessionId, SessionProps> {
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
  }): Session {
    return new Session(params.id, {
      userId: UserId.reconstitute(params.userId),
      refreshTokenHash: params.refreshTokenHash,
      previousTokenHash: null,
      tokenFamily: params.tokenFamily,
      tokenVersion: 1,
      deviceFingerprint: params.deviceFingerprint.substring(
        0,
        SESSION_DEFAULTS.MAX_DEVICE_FINGERPRINT_LENGTH,
      ),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      lastUsedAt: params.now,
      createdAt: params.now,
      updatedAt: params.now,
      expiresAt: params.expiresAt,
      revokedAt: null,
      revokedReason: null,
    });
  }

  static reconstitute(primitives: SessionPrimitives): Session {
    const { id, userId, ...props } = primitives;
    const session = new Session(SessionId.reconstitute(id), {
      ...props,
      userId: UserId.reconstitute(userId),
    });
    session.#persistedTokenVersion = primitives.tokenVersion;
    return session;
  }

  #persistedTokenVersion: number | null = null;

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

  // 저장소가 경합을 막는 조건이다. 읽은 뒤 다른 요청이 회전·폐기했으면 저장이 false다. 새 세션은 null
  get persistedTokenVersion(): number | null {
    return this.#persistedTokenVersion;
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

  hasRotatedSinceLoad(): boolean {
    return (
      this.#persistedTokenVersion != null && this.props.tokenVersion !== this.#persistedTokenVersion
    );
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
  rotate(params: {
    readonly refreshTokenHash: string;
    readonly expiresAt: Temporal.Instant;
    readonly now: Temporal.Instant;
  }): boolean {
    const validity = this.validityAt(params.now);
    if (validity === "revoked") {
      throw revokedSessionNotRotatable(this.id.value);
    }
    if (validity === "expired") {
      throw expiredSessionNotRotatable(this.id.value);
    }
    this.props.previousTokenHash = this.props.refreshTokenHash;
    this.props.refreshTokenHash = params.refreshTokenHash;
    this.props.tokenVersion += 1;
    this.props.expiresAt = params.expiresAt;
    this.props.lastUsedAt = params.now;
    this.props.updatedAt = params.now;
    return true;
  }

  // 이미 폐기한 세션은 처음 폐기 시각과 사유를 그대로 둔다
  revoke(reason: RevokeReason, now: Temporal.Instant): boolean {
    if (this.isRevoked()) {
      return false;
    }
    this.props.revokedAt = now;
    this.props.revokedReason = reason;
    this.props.updatedAt = now;
    return true;
  }

  toPrimitives(): SessionPrimitives {
    return { id: this.id.value, ...this.props, userId: this.props.userId.value };
  }
}
