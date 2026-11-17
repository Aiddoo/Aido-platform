import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";

import type {
  CachedSession,
  SessionCachePort,
} from "../../application/ports/session-cache.port.js";
import type { SessionId } from "../../domain/session-id.vo.js";
import {
  SESSION_CACHE_TTL_MS,
  SESSION_INVALIDATION_TTL_MS,
  SessionCacheKey,
} from "../cache/session-cache.keyspace.js";

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
    if (await this.#isInvalidated(sessionId)) {
      return null;
    }
    const cached = await this.#cacheService.get(
      SessionCacheKey.session(sessionId.value),
      CACHED_SESSION_SCHEMA,
    );
    return cached ?? null;
  }

  // 확인 요청이 DB를 읽는 사이 폐기되면 그 뒤 쓰기를 버린다. 쓴 직후 폐기됐으면 지운다
  async setSession(sessionId: SessionId, session: CachedSession): Promise<void> {
    if (await this.#isInvalidated(sessionId)) {
      return;
    }
    const key = SessionCacheKey.session(sessionId.value);
    await this.#cacheService.set(key, session, SESSION_CACHE_TTL_MS);
    if (await this.#isInvalidated(sessionId)) {
      await this.#cacheService.del(key);
    }
  }

  async invalidateSession(sessionId: SessionId): Promise<void> {
    await this.#cacheService.set(
      SessionCacheKey.invalidated(sessionId.value),
      true,
      SESSION_INVALIDATION_TTL_MS,
    );
    await this.#cacheService.del(SessionCacheKey.session(sessionId.value));
  }

  evictSession(sessionId: SessionId): Promise<void> {
    return this.#cacheService.del(SessionCacheKey.session(sessionId.value));
  }

  #isInvalidated(sessionId: SessionId): Promise<boolean> {
    return this.#cacheService.has(SessionCacheKey.invalidated(sessionId.value));
  }
}
