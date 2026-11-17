import type { RevokeReason } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SessionId } from "../../domain/session-id.vo.js";
import type { Session, SessionRotation } from "../../domain/session.aggregate.js";

export abstract class SessionRepositoryPort {
  abstract nextId(): Promise<SessionId>;
  abstract findById(sessionId: SessionId): Promise<Session | null>;
  abstract findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null>;
  /** 폐기되지 않고 만료 전인 세션을 최근 사용 순으로 준다 */
  abstract listActiveByUserId(userId: UserId, now: Temporal.Instant): Promise<Session[]>;
  abstract save(session: Session): Promise<void>;
  /** 버전이 그대로이고 폐기되지 않았을 때만 바꾼다. 경합에 지면 false다 */
  abstract rotateToken(
    sessionId: SessionId,
    rotation: SessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean>;
  abstract revoke(sessionId: SessionId, reason: RevokeReason, now: Temporal.Instant): Promise<void>;
  /** 아직 폐기되지 않은 세션만 폐기하고 그 id를 준다 */
  abstract revokeByTokenFamily(
    tokenFamily: string,
    reason: RevokeReason,
    now: Temporal.Instant,
  ): Promise<readonly SessionId[]>;
  /** 아직 폐기되지 않은 세션만 폐기하고 그 id를 준다 */
  abstract revokeAllByUserId(params: {
    readonly userId: UserId;
    readonly reason: RevokeReason;
    readonly now: Temporal.Instant;
    readonly exceptSessionId?: SessionId;
  }): Promise<readonly SessionId[]>;
}
