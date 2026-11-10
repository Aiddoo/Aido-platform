import type { RevokeReason } from "@aido/api/vocabulary";

import { AuthSessionRepositoryPort } from "#api/modules/identity/auth/application/ports/auth-session.repository.port";
import {
  AuthSession,
  type AuthSessionPrimitives,
  type AuthSessionRotation,
} from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { SessionId } from "#api/modules/identity/auth/domain/session-id.vo";

export class InMemoryAuthSessionRepository extends AuthSessionRepositoryPort {
  readonly #sessions = new Map<string, AuthSessionPrimitives>();
  // Drizzle 저장소가 감사용 revokedReason 칸에 남기는 값. 포트로는 읽지 않는다
  readonly revocationReasons = new Map<string, RevokeReason>();
  #sequence = 0;

  constructor(sessions: readonly AuthSession[] = []) {
    super();
    for (const session of sessions) {
      this.#sessions.set(session.id.value, session.toPrimitives());
    }
  }

  get all(): readonly AuthSessionPrimitives[] {
    return [...this.#sessions.values()];
  }

  stored(sessionId: string): AuthSessionPrimitives | undefined {
    return this.#sessions.get(sessionId);
  }

  async nextId(): Promise<SessionId> {
    this.#sequence += 1;
    return SessionId.reconstitute(`session-${this.#sequence}`);
  }

  async findById(sessionId: string): Promise<AuthSession | null> {
    const session = this.#sessions.get(sessionId);
    return session == null ? null : AuthSession.reconstitute(session);
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSession | null> {
    const session = this.all.find((candidate) => candidate.refreshTokenHash === refreshTokenHash);
    return session == null ? null : AuthSession.reconstitute(session);
  }

  async listActiveByUserId(userId: string, now: Temporal.Instant): Promise<AuthSession[]> {
    return this.all
      .filter(
        (session) =>
          session.userId === userId &&
          session.revokedAt == null &&
          Temporal.Instant.compare(session.expiresAt, now) > 0,
      )
      .toSorted((left, right) => Temporal.Instant.compare(right.lastUsedAt, left.lastUsedAt))
      .map((session) => AuthSession.reconstitute(session));
  }

  async save(session: AuthSession): Promise<void> {
    const saved = session.toPrimitives();
    const prior = this.#sessions.get(saved.id);
    // Drizzle 저장소처럼 다시 저장해도 소유자·기기·생성 시각은 처음 값을 둔다
    this.#sessions.set(
      saved.id,
      prior == null
        ? saved
        : {
            ...prior,
            refreshTokenHash: saved.refreshTokenHash,
            previousTokenHash: saved.previousTokenHash,
            tokenVersion: saved.tokenVersion,
            lastUsedAt: saved.lastUsedAt,
            expiresAt: saved.expiresAt,
            revokedAt: saved.revokedAt,
            updatedAt: saved.updatedAt,
          },
    );
  }

  async rotateToken(
    sessionId: string,
    rotation: AuthSessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const session = this.#sessions.get(sessionId);
    if (
      session == null ||
      session.revokedAt != null ||
      session.tokenVersion !== rotation.expectedTokenVersion
    ) {
      return false;
    }
    this.#sessions.set(sessionId, {
      ...session,
      refreshTokenHash: rotation.refreshTokenHash,
      previousTokenHash: rotation.previousTokenHash,
      tokenVersion: rotation.tokenVersion,
      expiresAt: rotation.expiresAt,
      lastUsedAt: now,
      updatedAt: now,
    });
    return true;
  }

  async revoke(sessionId: string, reason: RevokeReason, now: Temporal.Instant): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (session == null) {
      return;
    }
    this.#sessions.set(sessionId, { ...session, revokedAt: now, updatedAt: now });
    this.revocationReasons.set(sessionId, reason);
  }

  async revokeByTokenFamily(
    tokenFamily: string,
    reason: RevokeReason,
    now: Temporal.Instant,
  ): Promise<readonly string[]> {
    return this.#revokeWhere((session) => session.tokenFamily === tokenFamily, reason, now);
  }

  async revokeAllByUserId(params: {
    readonly userId: string;
    readonly reason: RevokeReason;
    readonly now: Temporal.Instant;
    readonly exceptSessionId?: string;
  }): Promise<readonly string[]> {
    const { userId, reason, now, exceptSessionId } = params;
    return this.#revokeWhere(
      (session) =>
        session.userId === userId &&
        (exceptSessionId == null || exceptSessionId === "" || session.id !== exceptSessionId),
      reason,
      now,
    );
  }

  async #revokeWhere(
    predicate: (session: AuthSessionPrimitives) => boolean,
    reason: RevokeReason,
    now: Temporal.Instant,
  ): Promise<readonly string[]> {
    const targets = this.all.filter((session) => session.revokedAt == null && predicate(session));
    for (const session of targets) {
      await this.revoke(session.id, reason, now);
    }
    return targets.map((session) => session.id);
  }
}
