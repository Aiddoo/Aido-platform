/**
 * RedisLockAdapter 단위 테스트
 *
 * @description
 * - SET NX PX 기반 락 획득/해제 happy path (ioredis-mock)
 * - Redis 장애 시 fail-closed: acquire→null(busy 취급), release는
 *   no-throw(TTL이 정리), isLocked→true
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test redis-lock.adapter
 * ```
 */
import RedisMock from "ioredis-mock";

import { RedisErrorLogSampler } from "../../redis/redis-error-log-sampler";
import { RedisLockAdapter } from "./redis-lock.adapter";

describe("RedisLockAdapter — Redis 분산 잠금 어댑터", () => {
	let redis: InstanceType<typeof RedisMock>;
	let warn: jest.Mock;
	let lock: RedisLockAdapter;

	beforeEach(async () => {
		// ioredis-mock은 인스턴스 간 전역 스토어를 공유하므로 테스트마다 초기화
		redis = new RedisMock();
		await redis.flushall();
		warn = jest.fn();
		lock = new RedisLockAdapter(redis, new RedisErrorLogSampler({ warn }));
	});

	describe("정상 동작", () => {
		it("락을 획득하면 release 함수를 반환한다", async () => {
			// When
			const release = await lock.acquire("resource", 5000);

			// Then
			expect(release).not.toBeNull();
			expect(await lock.isLocked("resource")).toBe(true);
		});

		it("이미 잠긴 리소스는 null을 반환한다", async () => {
			// Given
			await lock.acquire("resource", 5000);

			// When
			const second = await lock.acquire("resource", 5000);

			// Then
			expect(second).toBeNull();
		});

		it("release 후 다시 획득할 수 있다", async () => {
			// Given
			const release = await lock.acquire("resource", 5000);

			// When
			await release?.();
			const reacquired = await lock.acquire("resource", 5000);

			// Then
			expect(reacquired).not.toBeNull();
		});

		it("잠기지 않은 리소스의 isLocked는 false다", async () => {
			// When / Then
			expect(await lock.isLocked("free")).toBe(false);
		});
	});

	describe("fail-closed (Redis 장애 시)", () => {
		const failure = new Error("Connection is closed.");

		it("acquire 실패 시 null(busy 취급)을 반환한다", async () => {
			// Given
			jest.spyOn(redis, "set").mockRejectedValue(failure);

			// When
			const release = await lock.acquire("resource", 5000);

			// Then — 소비처는 busy와 동일하게 스킵/재시도 경로를 탄다
			expect(release).toBeNull();
			expect(warn).toHaveBeenCalledTimes(1);
		});

		it("release 실패는 throw하지 않는다 (TTL이 정리)", async () => {
			// Given
			const release = await lock.acquire("resource", 5000);
			jest.spyOn(redis, "eval").mockRejectedValue(failure);

			// When / Then
			await expect(release?.()).resolves.toBeUndefined();
			expect(warn).toHaveBeenCalledTimes(1);
		});

		it("isLocked 실패 시 true(fail-closed)를 반환한다", async () => {
			// Given
			jest.spyOn(redis, "exists").mockRejectedValue(failure);

			// When / Then
			expect(await lock.isLocked("resource")).toBe(true);
		});
	});
});
