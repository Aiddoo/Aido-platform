import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import {
  GenerationGuardedCache,
  type GenerationGuardedCacheKey,
} from "#api/platform/cache/generation-guarded-cache";

import type {
  CachedSession,
  SessionCachePort,
} from "../../application/ports/session-cache.port.js";
import type { SessionId } from "../../domain/session-id.vo.js";
import {
  SESSION_CACHE_TTL_MS,
  SESSION_GENERATION_TTL_MS,
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

function sessionKey(sessionId: SessionId): GenerationGuardedCacheKey {
  return {
    valueKey: SessionCacheKey.session(sessionId.value),
    generationKey: SessionCacheKey.sessionGeneration(sessionId.value),
  };
}

@Injectable()
export class SessionCacheAdapter implements SessionCachePort {
  readonly #sessions: GenerationGuardedCache;
  readonly #cacheService: CacheStorePort;

  constructor(cacheService: CacheStorePort) {
    this.#sessions = new GenerationGuardedCache(cacheService, SESSION_GENERATION_TTL_MS);
    this.#cacheService = cacheService;
  }

  wrapSession(sessionId: SessionId, factory: () => Promise<CachedSession>): Promise<CachedSession> {
    return this.#sessions.wrap<CachedSession>(
      sessionKey(sessionId),
      CACHED_SESSION_SCHEMA,
      factory,
      SESSION_CACHE_TTL_MS,
    );
  }

  invalidateSession(sessionId: SessionId): Promise<void> {
    return this.#sessions.invalidate(sessionKey(sessionId));
  }

  evictSession(sessionId: SessionId): Promise<void> {
    return this.#cacheService.del(SessionCacheKey.session(sessionId.value));
  }
}
