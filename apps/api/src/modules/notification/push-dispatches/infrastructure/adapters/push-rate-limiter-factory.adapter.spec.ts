import { Redis } from "ioredis";
import { Pool } from "pg";

import { createDatabase } from "#api/platform/database/database.client";
import { DateClock } from "#test/doubles/platform/date-clock";

import { InMemoryPushRateLimiterAdapter } from "./in-memory-push-rate-limiter.adapter.js";
import { PostgresPushRateLimiterAdapter } from "./postgres-push-rate-limiter.adapter.js";
import { selectPushRateLimiter } from "./push-rate-limiter-factory.adapter.js";
import { RedisPushRateLimiterAdapter } from "./redis-push-rate-limiter.adapter.js";

describe("selectPushRateLimiter", () => {
  // 연결하지 않는 client다. 어떤 구현을 고르는지만 본다
  const postgres = new PostgresPushRateLimiterAdapter(createDatabase(new Pool()), new DateClock());

  it("PostgreSQL을 기본 운영 구현으로 생성한다", () => {
    // When
    const limiter = selectPushRateLimiter("postgres", { postgres });

    // Then
    expect(limiter).toBeInstanceOf(PostgresPushRateLimiterAdapter);
  });

  it("Redis/Valkey 호환 command client가 있을 때 Redis 구현을 생성한다", () => {
    // Given
    const redis = new Redis({ lazyConnect: true });

    // When
    const limiter = selectPushRateLimiter("redis", { postgres, redis });

    // Then
    expect(limiter).toBeInstanceOf(RedisPushRateLimiterAdapter);
    redis.disconnect();
  });

  it("Redis를 선택하고 client가 없으면 메모리로 폴백하지 않는다", () => {
    // When
    const create = () => selectPushRateLimiter("redis", { postgres });

    // Then
    expect(create).toThrow(
      "PUSH_RATE_LIMIT_BACKEND=redis requires a configured Redis command client",
    );
  });

  it("memory는 명시적으로 선택한 개발·테스트 환경에서만 생성한다", () => {
    // When
    const limiter = selectPushRateLimiter("memory", { postgres });

    // Then
    expect(limiter).toBeInstanceOf(InMemoryPushRateLimiterAdapter);
  });
});
