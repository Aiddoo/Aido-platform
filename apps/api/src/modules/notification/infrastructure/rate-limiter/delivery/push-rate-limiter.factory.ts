import type { Redis } from "ioredis";

import type { DatabaseService } from "#api/platform/database/database.service";

import type { PushRateLimiterPort } from "../../../application/ports/delivery/push-rate-limiter.port.js";
import { InMemoryPushRateLimiter } from "./in-memory-push-rate-limiter.js";
import { PostgresPushRateLimiter } from "./postgres-push-rate-limiter.js";
import { RedisPushRateLimiter } from "./redis-push-rate-limiter.js";

export type PushRateLimitBackend = "postgres" | "redis" | "memory";

interface CreatePushRateLimiterInput {
  readonly backend: PushRateLimitBackend;
  readonly database: DatabaseService;
  readonly redis?: Redis;
}

export function createPushRateLimiter(input: CreatePushRateLimiterInput): PushRateLimiterPort {
  switch (input.backend) {
    case "postgres":
      return new PostgresPushRateLimiter(input.database);
    case "redis":
      if (!input.redis) {
        throw new Error("PUSH_RATE_LIMIT_BACKEND=redis requires a configured Redis command client");
      }
      return new RedisPushRateLimiter(input.redis);
    case "memory":
      return new InMemoryPushRateLimiter();
  }
}
