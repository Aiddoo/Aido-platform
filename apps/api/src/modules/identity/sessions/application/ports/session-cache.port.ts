import type { SessionId } from "../../domain/session-id.vo.js";

export interface CachedSession {
  readonly userId: string;
  readonly expiresAt: Date | string;
  readonly revokedAt: Date | string | null;
  readonly userStatus?: string;
  readonly userDeletedAt?: string | null;
}

export abstract class SessionCachePort {
  abstract getSession(sessionId: SessionId): Promise<CachedSession | null>;
  abstract setSession(sessionId: SessionId, session: CachedSession): Promise<void>;
  /** 폐기한 세션. 폐기 뒤 늦게 도착한 쓰기가 세션을 되살리지 못하게 표시를 남긴다 */
  abstract invalidateSession(sessionId: SessionId): Promise<void>;
  /** 회전으로 만료 시각만 바뀐 세션. 살아 있는 세션이라 표시 없이 지운다 */
  abstract evictSession(sessionId: SessionId): Promise<void>;
}
