import type { RevokeReason } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SessionId } from "../../domain/session-id.vo.js";
import type { Session } from "../../domain/session.aggregate.js";

export abstract class SessionRepositoryPort {
  abstract nextId(): Promise<SessionId>;
  abstract findById(sessionId: SessionId): Promise<Session | null>;
  abstract findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null>;
  /** 폐기되지 않고 만료 전인 세션을 최근 사용 순으로 준다 */
  abstract listActiveByUserId(userId: UserId, now: Temporal.Instant): Promise<Session[]>;
  /**
   * 새 세션은 넣는다. 읽은 세션은 폐기 전일 때만 바꾸고, 회전했으면 읽을 때의 버전일 때만 바꾼다.
   * 그 사이 다른 요청이 폐기·회전했으면 false다
   */
  abstract save(session: Session): Promise<boolean>;
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
  /**
   * 폐기나 만료가 cutoff 전인 세션을 limit개까지 지우고 지운 수를 준다.
   * 지우면 묶인 푸시 기기도 지워지므로 푸시 기기가 남은 만료 세션은 두고, 폐기한 세션은 기기째 지운다
   */
  abstract deleteEndedBefore(cutoff: Temporal.Instant, limit: number): Promise<number>;
}
