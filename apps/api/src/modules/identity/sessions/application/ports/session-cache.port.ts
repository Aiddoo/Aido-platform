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
  abstract invalidateSession(sessionId: SessionId): Promise<void>;
}
