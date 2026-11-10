import type { Redis } from "ioredis";

import type { Database } from "#api/platform/database/database.client";

import type { PushRateLimiterPort } from "../../application/ports/push-rate-limiter.port.js";
import { InMemoryPushRateLimiterAdapter } from "./in-memory-push-rate-limiter.adapter.js";
import { PostgresPushRateLimiterAdapter } from "./postgres-push-rate-limiter.adapter.js";
import { RedisPushRateLimiterAdapter } from "./redis-push-rate-limiter.adapter.js";

export type PushRateLimitBackend = "postgres" | "redis" | "memory";

interface CreatePushRateLimiterInput {
  readonly backend: PushRateLimitBackend;
  readonly database: Database;
  readonly redis?: Redis;
}

export function createPushRateLimiter(input: CreatePushRateLimiterInput): PushRateLimiterPort {
  switch (input.backend) {
    case "postgres":
      return new PostgresPushRateLimiterAdapter(input.database);
    case "redis":
      if (!input.redis) {
        throw new Error("PUSH_RATE_LIMIT_BACKEND=redis requires a configured Redis command client");
      }
      return new RedisPushRateLimiterAdapter(input.redis);
    case "memory":
      return new InMemoryPushRateLimiterAdapter();
  }
}
