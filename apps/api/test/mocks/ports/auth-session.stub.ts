import type { UserRole } from "@aido/api/vocabulary";

import type { AuthCachePort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import type {
  AuthTokenIssuerPort,
  TokenPair,
} from "#api/modules/identity/auth/application/ports/auth-crypto.port";
import type {
  AuthSecurityLogRepositoryPort,
  AuthSessionRecord,
  AuthSessionRepositoryPort,
  NewAuthSession,
} from "#api/modules/identity/auth/application/ports/auth-persistence.port";
import type { SessionPushDeviceReleaserPort } from "#api/modules/identity/auth/application/ports/session-push-device-releaser.port";
import {
  AuthSession,
  type AuthSessionRotation,
} from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";
import { SessionFixture } from "#test/fixtures/session.fixture";

function toAuthSession(record: AuthSessionRecord): AuthSession {
  return AuthSession.reconstitute({
    ...record,
    lastUsedAt: instantFromDate(record.lastUsedAt),
    createdAt: instantFromDate(record.createdAt),
    expiresAt: instantFromDate(record.expiresAt),
    revokedAt: record.revokedAt == null ? null : instantFromDate(record.revokedAt),
  });
}

type SessionOperations = Pick<
  AuthSessionRepositoryPort,
  | "create"
  | "updateRefreshTokenHash"
  | "findById"
  | "findByRefreshTokenHash"
  | "findActiveByUserId"
  | "rotateToken"
  | "revoke"
  | "revokeAllByUserId"
  | "revokeByTokenFamily"
>;

export class StubAuthSessionRepository implements SessionOperations {
  readonly sessions: Map<string, AuthSessionRecord>;
  readonly creations: NewAuthSession[] = [];
  readonly revocationReasons = new Map<string, string>();
  rejectRotation = false;

  constructor(sessions: readonly AuthSessionRecord[] = []) {
    this.sessions = new Map(sessions.map((session) => [session.id, { ...session }]));
  }

  async create(input: NewAuthSession): Promise<AuthSessionRecord> {
    const session = SessionFixture.create({ ...input, expiresAt: instantToDate(input.expiresAt) });
    session.refreshTokenHash = `pending:${session.id}`;
    this.creations.push(input);
    this.sessions.set(session.id, session);
    return session;
  }

  async updateRefreshTokenHash(id: string, refreshTokenHash: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session === undefined) {
      throw new Error(`존재하지 않는 세션: ${id}`);
    }
    this.sessions.set(id, { ...session, refreshTokenHash });
  }

  async findById(id: string): Promise<AuthSession | null> {
    const session = this.sessions.get(id);
    return session == null ? null : toAuthSession(session);
  }

  async findByRefreshTokenHash(hash: string): Promise<AuthSession | null> {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === hash,
    );
    return session == null ? null : toAuthSession(session);
  }

  async findActiveByUserId(userId: string): Promise<AuthSessionRecord[]> {
    return [...this.sessions.values()].filter(
      (session) =>
        session.userId === userId &&
        session.revokedAt === null &&
        session.expiresAt.getTime() > Date.now(),
    );
  }

  async rotateToken(
    id: string,
    input: AuthSessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const session = this.sessions.get(id);
    if (
      this.rejectRotation ||
      session === undefined ||
      session.revokedAt !== null ||
      session.tokenVersion !== input.expectedTokenVersion
    ) {
      return false;
    }
    const rotated = {
      ...session,
      refreshTokenHash: input.refreshTokenHash,
      previousTokenHash: input.previousTokenHash,
      tokenVersion: input.tokenVersion,
      expiresAt: instantToDate(input.expiresAt),
      lastUsedAt: instantToDate(now),
    };
    this.sessions.set(id, rotated);
    return true;
  }

  async revoke(id: string, reason: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session === undefined) {
      throw new Error(`존재하지 않는 세션: ${id}`);
    }
    this.sessions.set(id, { ...session, revokedAt: new Date() });
    this.revocationReasons.set(id, reason);
  }

  async revokeByTokenFamily(tokenFamily: string, reason: string): Promise<readonly string[]> {
    const sessions = [...this.sessions.values()].filter(
      (session) => session.tokenFamily === tokenFamily && session.revokedAt === null,
    );
    for (const session of sessions) {
      await this.revoke(session.id, reason);
    }
    return sessions.map((session) => session.id);
  }

  async revokeAllByUserId(
    userId: string,
    reason: string,
    excludeSessionId?: string,
  ): Promise<readonly string[]> {
    const sessions = [...this.sessions.values()].filter(
      (session) =>
        session.userId === userId && session.revokedAt === null && session.id !== excludeSessionId,
    );
    for (const session of sessions) {
      await this.revoke(session.id, reason);
    }
    return sessions.map((session) => session.id);
  }
}

export class StubAuthSessionCache implements Pick<AuthCachePort, "invalidateSession"> {
  readonly sessionIds: Set<string>;

  constructor(sessionIds: readonly string[] = []) {
    this.sessionIds = new Set(sessionIds);
  }

  async invalidateSession(sessionId: string): Promise<void> {
    this.sessionIds.delete(sessionId);
  }
}

/** 폐기 뒤 푸시 기기 해제를 요청한 세션을 순서대로 기록한다. */
export class StubSessionPushDeviceReleaser implements SessionPushDeviceReleaserPort {
  readonly releasedSessionIds: string[] = [];

  async releaseSessions(sessionIds: readonly string[]): Promise<void> {
    this.releasedSessionIds.push(...sessionIds);
  }
}

export class StubAuthSecurityLogRepository implements Pick<
  AuthSecurityLogRepositoryPort,
  "create"
> {
  readonly entries: Parameters<AuthSecurityLogRepositoryPort["create"]>[0][] = [];

  async create(entry: Parameters<AuthSecurityLogRepositoryPort["create"]>[0]): Promise<void> {
    this.entries.push(entry);
  }
}

export class StubAuthTokenIssuer implements Pick<
  AuthTokenIssuerPort,
  | "generateTokenFamily"
  | "generateTokenPair"
  | "hashRefreshToken"
  | "getRefreshTokenExpiresInSeconds"
> {
  #familyCount = 0;
  readonly issued: {
    userId: string;
    email: string;
    sessionId: string;
    role: UserRole;
    tokenFamily?: string;
    tokenVersion?: number;
  }[] = [];
  readonly refreshTokenExpiresInSeconds = 604_800;

  generateTokenFamily(): string {
    this.#familyCount += 1;
    return `token-family-${this.#familyCount}`;
  }

  async generateTokenPair(
    userId: string,
    email: string,
    sessionId: string,
    role: UserRole,
    tokenFamily?: string,
    tokenVersion?: number,
  ): Promise<TokenPair> {
    this.issued.push({ userId, email, sessionId, role, tokenFamily, tokenVersion });
    return {
      accessToken: `access:${sessionId}:${tokenVersion}`,
      refreshToken: `refresh:${sessionId}:${tokenVersion}`,
      expiresIn: 900,
    };
  }

  hashRefreshToken(token: string): string {
    return `digest:${token}`;
  }

  getRefreshTokenExpiresInSeconds(): number {
    return this.refreshTokenExpiresInSeconds;
  }
}
