import type Redis from "ioredis";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { InMemoryPushRateLimiter } from "./in-memory-push-rate-limiter";
import { PostgresPushRateLimiter } from "./postgres-push-rate-limiter";
import { createPushRateLimiter } from "./push-rate-limiter.factory";
import { RedisPushRateLimiter } from "./redis-push-rate-limiter";

describe("createPushRateLimiter", () => {
	const database = {} as DatabaseService;

	it("PostgreSQL을 기본 운영 구현으로 생성한다", () => {
		expect(createPushRateLimiter({ backend: "postgres", database })).toBeInstanceOf(
			PostgresPushRateLimiter,
		);
	});

	it("Redis/Valkey 호환 command client가 있을 때 Redis 구현을 생성한다", () => {
		const redis = {} as Redis;
		expect(createPushRateLimiter({ backend: "redis", database, redis })).toBeInstanceOf(
			RedisPushRateLimiter,
		);
	});

	it("Redis를 선택하고 client가 없으면 메모리로 폴백하지 않는다", () => {
		expect(() => createPushRateLimiter({ backend: "redis", database })).toThrow(
			"PUSH_RATE_LIMIT_BACKEND=redis requires a configured Redis command client",
		);
	});

	it("memory는 명시적으로 선택한 개발·테스트 환경에서만 생성한다", () => {
		const limiter = createPushRateLimiter({ backend: "memory", database });
		expect(limiter).toBeInstanceOf(InMemoryPushRateLimiter);
		limiter.destroy?.();
	});
});
