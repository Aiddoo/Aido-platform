import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";

import type {
  CachedSession,
  SessionCachePort,
} from "../../application/ports/session-cache.port.js";
import type { SessionId } from "../../domain/session-id.vo.js";
import { SESSION_CACHE_TTL_MS, SessionCacheKey } from "../cache/session-cache.keyspace.js";

/** in-memory는 Date, Redis는 ISO 문자열을 돌려주므로 둘 다 받는다(포트 타입과 같다). */
const CACHED_TIMESTAMP_SCHEMA = z.union([z.date(), z.string()]);

const CACHED_SESSION_SCHEMA = z.looseObject({
  userId: z.string(),
  expiresAt: CACHED_TIMESTAMP_SCHEMA,
  revokedAt: CACHED_TIMESTAMP_SCHEMA.nullable(),
  userStatus: z.string().optional(),
  userDeletedAt: z.string().nullable().optional(),
}) satisfies z.ZodType<CachedSession>;

@Injectable()
export class SessionCacheAdapter implements SessionCachePort {
  readonly #cacheService: CacheStorePort;

  constructor(cacheService: CacheStorePort) {
    this.#cacheService = cacheService;
  }

  async getSession(sessionId: SessionId): Promise<CachedSession | null> {
    const cached = await this.#cacheService.get(
      SessionCacheKey.session(sessionId.value),
      CACHED_SESSION_SCHEMA,
    );
    return cached ?? null;
  }

  setSession(sessionId: SessionId, session: CachedSession): Promise<void> {
    return this.#cacheService.set(
      SessionCacheKey.session(sessionId.value),
      session,
      SESSION_CACHE_TTL_MS,
    );
  }

  invalidateSession(sessionId: SessionId): Promise<void> {
    return this.#cacheService.del(SessionCacheKey.session(sessionId.value));
  }
}
