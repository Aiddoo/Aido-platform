import type { RevokeReason } from "@aido/api/vocabulary";

import { SessionRepositoryPort } from "#api/modules/identity/sessions/application/ports/session.repository.port";
import { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import {
  Session,
  type SessionPrimitives,
  type SessionRotation,
} from "#api/modules/identity/sessions/domain/session.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class InMemorySessionRepository extends SessionRepositoryPort {
  readonly #sessions = new Map<string, SessionPrimitives>();
  // Drizzle 저장소가 감사용 revokedReason 칸에 남기는 값. 포트로는 읽지 않는다
  readonly revocationReasons = new Map<string, RevokeReason>();
  #sequence = 0;

  constructor(sessions: readonly Session[] = []) {
    super();
    for (const session of sessions) {
      this.#sessions.set(session.id.value, session.toPrimitives());
    }
  }

  get all(): readonly SessionPrimitives[] {
    return [...this.#sessions.values()];
  }

  stored(sessionId: string): SessionPrimitives | undefined {
    return this.#sessions.get(sessionId);
  }

  async nextId(): Promise<SessionId> {
    this.#sequence += 1;
    return SessionId.reconstitute(`session-${this.#sequence}`);
  }

  async findById(sessionId: SessionId): Promise<Session | null> {
    const session = this.#sessions.get(sessionId.value);
    return session == null ? null : Session.reconstitute(session);
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    const session = this.all.find((candidate) => candidate.refreshTokenHash === refreshTokenHash);
    return session == null ? null : Session.reconstitute(session);
  }

  async listActiveByUserId(userId: UserId, now: Temporal.Instant): Promise<Session[]> {
    return this.all
      .filter(
        (session) =>
          session.userId === userId.value &&
          session.revokedAt == null &&
          Temporal.Instant.compare(session.expiresAt, now) > 0,
      )
      .toSorted((left, right) => Temporal.Instant.compare(right.lastUsedAt, left.lastUsedAt))
      .map((session) => Session.reconstitute(session));
  }

  async save(session: Session): Promise<void> {
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
    sessionId: SessionId,
    rotation: SessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const session = this.#sessions.get(sessionId.value);
    if (
      session == null ||
      session.revokedAt != null ||
      session.tokenVersion !== rotation.expectedTokenVersion
    ) {
      return false;
    }
    this.#sessions.set(sessionId.value, {
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

  async revoke(sessionId: SessionId, reason: RevokeReason, now: Temporal.Instant): Promise<void> {
    const session = this.#sessions.get(sessionId.value);
    if (session == null) {
      return;
    }
    this.#sessions.set(sessionId.value, { ...session, revokedAt: now, updatedAt: now });
    this.revocationReasons.set(sessionId.value, reason);
  }

  async revokeByTokenFamily(
    tokenFamily: string,
    reason: RevokeReason,
    now: Temporal.Instant,
  ): Promise<readonly SessionId[]> {
    return this.#revokeWhere((session) => session.tokenFamily === tokenFamily, reason, now);
  }

  async revokeAllByUserId(params: {
    readonly userId: UserId;
    readonly reason: RevokeReason;
    readonly now: Temporal.Instant;
    readonly exceptSessionId?: SessionId;
  }): Promise<readonly SessionId[]> {
    const { userId, reason, now, exceptSessionId } = params;
    return this.#revokeWhere(
      (session) =>
        session.userId === userId.value &&
        (exceptSessionId == null ||
          exceptSessionId.value === "" ||
          session.id !== exceptSessionId.value),
      reason,
      now,
    );
  }

  async #revokeWhere(
    predicate: (session: SessionPrimitives) => boolean,
    reason: RevokeReason,
    now: Temporal.Instant,
  ): Promise<readonly SessionId[]> {
    const targets = this.all.filter((session) => session.revokedAt == null && predicate(session));
    for (const session of targets) {
      await this.revoke(SessionId.reconstitute(session.id), reason, now);
    }
    return targets.map((session) => SessionId.reconstitute(session.id));
  }
}
