import type { RevokeReason } from "@aido/api/vocabulary";

import type { AuthSession, AuthSessionRotation } from "../../domain/auth-session.aggregate.js";
import type { SessionId } from "../../domain/session-id.vo.js";

export abstract class AuthSessionRepositoryPort {
  abstract nextId(): Promise<SessionId>;
  abstract findById(sessionId: string): Promise<AuthSession | null>;
  abstract findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSession | null>;
  /** 폐기되지 않고 만료 전인 세션을 최근 사용 순으로 준다 */
  abstract listActiveByUserId(userId: string, now: Temporal.Instant): Promise<AuthSession[]>;
  abstract save(session: AuthSession): Promise<void>;
  /** 버전이 그대로이고 폐기되지 않았을 때만 바꾼다. 경합에 지면 false다 */
  abstract rotateToken(
    sessionId: string,
    rotation: AuthSessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean>;
  abstract revoke(sessionId: string, reason: RevokeReason, now: Temporal.Instant): Promise<void>;
  /** 아직 폐기되지 않은 세션만 폐기하고 그 id를 준다 */
  abstract revokeByTokenFamily(
    tokenFamily: string,
    reason: RevokeReason,
    now: Temporal.Instant,
  ): Promise<readonly string[]>;
  /** 아직 폐기되지 않은 세션만 폐기하고 그 id를 준다 */
  abstract revokeAllByUserId(params: {
    readonly userId: string;
    readonly reason: RevokeReason;
    readonly now: Temporal.Instant;
    readonly exceptSessionId?: string;
  }): Promise<readonly string[]>;
}
