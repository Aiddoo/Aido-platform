import { mockOf } from "@test/mocks";
import type Redis from "ioredis";
import { RedisPushRateLimiter } from "./redis-push-rate-limiter";

describe("RedisPushRateLimiter batch policy", () => {
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
});
