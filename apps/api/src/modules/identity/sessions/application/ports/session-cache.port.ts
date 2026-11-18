import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SessionId } from "../../domain/session-id.vo.js";

export interface CachedSession {
  readonly userId: UserId;
  readonly expiresAt: Date | string;
  readonly revokedAt: Date | string | null;
  readonly userStatus?: string;
  readonly userDeletedAt?: string | null;
}

export abstract class SessionCachePort {
  /** 캐시에 없으면 factory 값을 30초 둔다. factory가 읽는 사이 폐기됐으면 두지 않는다 */
  abstract wrapSession(
    sessionId: SessionId,
    factory: () => Promise<CachedSession>,
  ): Promise<CachedSession>;
  /** 폐기한 세션. 세대를 바꿔 폐기 전에 시작한 읽기가 늦게 세션을 되살리지 못하게 한다 */
  abstract invalidateSession(sessionId: SessionId): Promise<void>;
  /** 회전으로 만료 시각만 바뀐 세션. 살아 있는 세션이라 세대를 두고 값만 지워 다시 캐시한다 */
  abstract evictSession(sessionId: SessionId): Promise<void>;
}
