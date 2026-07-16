import { TEST_CUID } from "@test/fixtures/id.fixture";
import { mockOf } from "@test/mocks";
import type Redis from "ioredis";
import RedisMock from "ioredis-mock";
import { RedisPushRateLimiter } from "./redis-push-rate-limiter";

describe("RedisPushRateLimiter batch policy", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("여러 사용자의 일반·참여 유도 제한을 단일 원자적 Redis 호출로 예약한다", async () => {
		const redis = mockOf<Redis>({ eval: jest.fn() });
		redis.eval.mockResolvedValue([0, 1, 0]);
		const limiter = new RedisPushRateLimiter(redis);

		await expect(
			limiter.reserveBatch([
				{ userId: "user-1", engagementLocalDate: "2026-07-16" },
				{ userId: "user-2" },
				{ userId: "user-3", engagementLocalDate: "2026-07-15" },
			]),
		).resolves.toEqual([false, true, false]);
		expect(redis.eval).toHaveBeenCalledTimes(1);
	});

	it("Redis가 잘못된 결과를 반환하면 fail-open으로 전체 발송을 허용한다", async () => {
		const redis = mockOf<Redis>({ eval: jest.fn() });
		redis.eval.mockResolvedValue([0, "invalid"]);
		const limiter = new RedisPushRateLimiter(redis);

		await expect(
			limiter.reserveBatch([{ userId: "user-1" }, { userId: "user-2" }]),
		).resolves.toEqual([false, false]);
	});

	it("빈 배치는 Redis를 호출하지 않는다", async () => {
		const redis = mockOf<Redis>({ eval: jest.fn() });
		const limiter = new RedisPushRateLimiter(redis);

		await expect(limiter.reserveBatch([])).resolves.toEqual([]);
		expect(redis.eval).not.toHaveBeenCalled();
	});

	it("참여 유도 제한에 걸리면 일반 푸시 quota를 소비하지 않는다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-16T10:00:00.000Z"));
		const redis = new RedisMock();
		await redis.flushall();
		await redis.hset(
			`push-engagement:${TEST_CUID.USER_1}:2026-07-16`,
			"count",
			"2",
			"lastSentAt",
			"0",
		);
		const limiter = new RedisPushRateLimiter(redis);

		await expect(
			limiter.reserveBatch([
				{
					userId: TEST_CUID.USER_1,
					engagementLocalDate: "2026-07-16",
				},
			]),
		).resolves.toEqual([true]);
		expect(await redis.zcard(`push-rate:${TEST_CUID.USER_1}`)).toBe(0);
	});
});
