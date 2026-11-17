import type { RevokeReason } from "@aido/api/vocabulary";

import { SessionRepositoryPort } from "#api/modules/identity/sessions/application/ports/session.repository.port";
import { SessionId } from "#api/modules/identity/sessions/domain/session-id.vo";
import {
  Session,
  type SessionPrimitives,
} from "#api/modules/identity/sessions/domain/session.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class InMemorySessionRepository extends SessionRepositoryPort {
  readonly #sessions = new Map<string, SessionPrimitives>();
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

  // Drizzle 저장소가 감사용 revokedReason 칸에 남기는 값. 포트로는 읽지 않는다
  get revocationReasons(): ReadonlyMap<string, string> {
    return new Map(
      this.all.flatMap((session) =>
        session.revokedReason == null ? [] : [[session.id, session.revokedReason] as const],
      ),
    );
  }

  // 테스트가 이미 저장된 세션을 놓는다. 포트의 save는 읽어 온 세션을 새로 넣지 않는다
  seed(session: Session): void {
    this.#sessions.set(session.id.value, session.toPrimitives());
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

  // Drizzle 저장소와 같은 조건이다. 폐기된 행은 바꾸지 않고, 회전은 읽을 때의 버전일 때만 쓴다
  async save(session: Session): Promise<boolean> {
    const saved = session.toPrimitives();
    const prior = this.#sessions.get(saved.id);
    if (session.persistedTokenVersion == null) {
      this.#sessions.set(saved.id, saved);
      return true;
    }
    if (prior == null || prior.revokedAt != null) {
      return false;
    }
    const revocation = {
      revokedAt: saved.revokedAt,
      revokedReason: saved.revokedReason,
      updatedAt: saved.updatedAt,
    };
    if (!session.hasRotatedSinceLoad()) {
      this.#sessions.set(saved.id, { ...prior, ...revocation });
      return true;
    }
    if (prior.tokenVersion !== session.persistedTokenVersion) {
      return false;
    }
    this.#sessions.set(saved.id, {
      ...prior,
      ...revocation,
      refreshTokenHash: saved.refreshTokenHash,
      previousTokenHash: saved.previousTokenHash,
      tokenVersion: saved.tokenVersion,
      lastUsedAt: saved.lastUsedAt,
      expiresAt: saved.expiresAt,
    });
    return true;
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

  #revokeWhere(
    predicate: (session: SessionPrimitives) => boolean,
    reason: RevokeReason,
    now: Temporal.Instant,
  ): readonly SessionId[] {
    const targets = this.all.filter((session) => session.revokedAt == null && predicate(session));
    for (const session of targets) {
      this.#sessions.set(session.id, {
        ...session,
        revokedAt: now,
        revokedReason: reason,
        updatedAt: now,
      });
    }
    return targets.map((session) => SessionId.reconstitute(session.id));
  }
}
