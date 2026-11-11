import type { Redis } from "ioredis";

import type { PushRateLimitBackend } from "#api/platform/config/schemas/push.schema";
import type { Database } from "#api/platform/database/database.client";

import type { PushRateLimiterPort } from "../../application/ports/push-rate-limiter.port.js";
import { InMemoryPushRateLimiterAdapter } from "./in-memory-push-rate-limiter.adapter.js";
import { PostgresPushRateLimiterAdapter } from "./postgres-push-rate-limiter.adapter.js";
import { RedisPushRateLimiterAdapter } from "./redis-push-rate-limiter.adapter.js";

interface PushRateLimiterSources {
  readonly database: Database;
  readonly redis?: Redis;
}

/** 저장소를 더하려면 PUSH_RATE_LIMIT_BACKENDS와 이 표에 한 줄씩 더한다. */
const limiters = {
  postgres: ({ database }) => new PostgresPushRateLimiterAdapter(database),
  redis: ({ redis }) => {
    if (!redis) {
      throw new Error("PUSH_RATE_LIMIT_BACKEND=redis requires a configured Redis command client");
    }
    return new RedisPushRateLimiterAdapter(redis);
  },
  memory: () => new InMemoryPushRateLimiterAdapter(),
} satisfies Record<PushRateLimitBackend, (sources: PushRateLimiterSources) => PushRateLimiterPort>;

export function selectPushRateLimiter(
  backend: PushRateLimitBackend,
  sources: PushRateLimiterSources,
): PushRateLimiterPort {
  return limiters[backend](sources);
}
