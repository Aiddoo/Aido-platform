import type { AuthSession, AuthSessionRotation } from "../../domain/auth-session.aggregate.js";
import type { DeviceFingerprint } from "../../domain/auth.constants.js";

export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  previousTokenHash: string | null;
  tokenFamily: string;
  tokenVersion: number;
  ipAddress: string;
  userAgent: string;
  lastUsedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface NewAuthSession {
  readonly userId: string;
  readonly tokenFamily: string;
  readonly tokenVersion: number;
  readonly deviceFingerprint: DeviceFingerprint;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly expiresAt: Temporal.Instant;
}

export abstract class AuthSessionRepositoryPort {
  abstract create(data: NewAuthSession): Promise<AuthSessionRecord>;
  abstract updateRefreshTokenHash(id: string, refreshTokenHash: string): Promise<unknown>;
  abstract findById(id: string): Promise<AuthSession | null>;
  abstract findByRefreshTokenHash(hash: string): Promise<AuthSession | null>;
  abstract findActiveByUserId(userId: string): Promise<AuthSessionRecord[]>;
  /** 버전이 그대로이고 폐기되지 않았을 때만 바꾼다. 경합에 지면 false다 */
  abstract rotateToken(
    id: string,
    rotation: AuthSessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean>;
  abstract revoke(id: string, reason: string): Promise<unknown>;
  abstract revokeByTokenFamily(tokenFamily: string, reason: string): Promise<readonly string[]>;
  abstract revokeAllByUserId(
    userId: string,
    reason: string,
    excludeSessionId?: string,
  ): Promise<readonly string[]>;
}
