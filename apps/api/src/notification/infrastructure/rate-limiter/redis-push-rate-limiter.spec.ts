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

	it("같은 dispatch 예약은 재시도와 새 publication generation에서도 quota를 한 번만 소비한다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-16T10:00:00.000Z"));
		const redis = new RedisMock();
		await redis.flushall();
		const limiter = new RedisPushRateLimiter(redis);
		const request = {
			userId: TEST_CUID.USER_1,
			engagementLocalDate: "2026-07-16",
			reservationId: "push-delivery-501",
		} as const;

		await expect(limiter.reserveBatch([request])).resolves.toEqual([false]);
		await expect(limiter.reserveBatch([request])).resolves.toEqual([false]);
		await expect(
			limiter.reserveBatch([{ ...request, reservationId: "push-delivery-502" }]),
		).resolves.toEqual([true]);

		expect(await redis.zcard(`push-rate:${TEST_CUID.USER_1}`)).toBe(1);
		expect(
			Number(await redis.hget(`push-engagement:${TEST_CUID.USER_1}:2026-07-16`, "count")),
		).toBe(1);
	});

	it("단건 일반·engagement 단계도 같은 dispatch 예약을 각각 재사용한다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-16T10:00:00.000Z"));
		const redis = new RedisMock();
		await redis.flushall();
		const limiter = new RedisPushRateLimiter(redis);
		const reservationId = "push-delivery-601";

		await expect(limiter.isRateLimited(TEST_CUID.USER_1, reservationId)).resolves.toBe(false);
		await expect(
			limiter.isEngagementRateLimited(TEST_CUID.USER_1, "2026-07-16", reservationId),
		).resolves.toBe(false);
		await expect(limiter.isRateLimited(TEST_CUID.USER_1, reservationId)).resolves.toBe(false);
		await expect(
			limiter.isEngagementRateLimited(TEST_CUID.USER_1, "2026-07-16", reservationId),
		).resolves.toBe(false);

		expect(await redis.zcard(`push-rate:${TEST_CUID.USER_1}`)).toBe(1);
		expect(
			Number(await redis.hget(`push-engagement:${TEST_CUID.USER_1}:2026-07-16`, "count")),
		).toBe(1);
	});

	it("batch 예약 marker는 general key 만료와 현지 날짜 변경 뒤에도 같은 dispatch를 재사용한다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-15T23:00:00.000Z"));
		const redis = new RedisMock();
		await redis.flushall();
		const limiter = new RedisPushRateLimiter(redis);
		const original = {
			userId: TEST_CUID.USER_1,
			engagementLocalDate: "2026-07-15",
			reservationId: "push-delivery-midnight",
		} as const;

		await expect(limiter.reserveBatch([original])).resolves.toEqual([false]);
		jest.advanceTimersByTime(5 * 60 * 60 * 1000);
		await expect(
			limiter.reserveBatch([
				{
					...original,
					engagementLocalDate: "2026-07-16",
					reservationId: "push-delivery-next-day-1",
				},
			]),
		).resolves.toEqual([false]);
		jest.advanceTimersByTime(4 * 60 * 60 * 1000);
		await expect(
			limiter.reserveBatch([
				{
					...original,
					engagementLocalDate: "2026-07-16",
					reservationId: "push-delivery-next-day-2",
				},
			]),
		).resolves.toEqual([false]);

		await expect(
			limiter.reserveBatch([{ ...original, engagementLocalDate: "2026-07-16" }]),
		).resolves.toEqual([false]);
		await expect(
			limiter.reserveBatch([
				{
					...original,
					engagementLocalDate: "2026-07-16",
					reservationId: "push-delivery-next-day-blocked",
				},
			]),
		).resolves.toEqual([true]);
		expect(
			await redis.exists(
				`push-rate-reservation:general:${TEST_CUID.USER_1}:push-delivery-midnight`,
			),
		).toBe(1);
		expect(
			await redis.exists(
				`push-rate-reservation:engagement:${TEST_CUID.USER_1}:push-delivery-midnight`,
			),
		).toBe(1);
	});

	it("단건 general 예약 직후 crash한 재시도는 key 만료 뒤에도 quota를 다시 쓰지 않는다", async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-15T23:00:00.000Z"));
		const redis = new RedisMock();
		await redis.flushall();
		const limiter = new RedisPushRateLimiter(redis);
		const reservationId = "push-delivery-general-phase";
		await expect(limiter.isRateLimited(TEST_CUID.USER_1, reservationId)).resolves.toBe(false);

		jest.advanceTimersByTime(2 * 60 * 60 * 1000);
		for (let index = 0; index < 15; index += 1) {
			await expect(limiter.isRateLimited(TEST_CUID.USER_1)).resolves.toBe(false);
		}
		await expect(limiter.isRateLimited(TEST_CUID.USER_1)).resolves.toBe(true);
		await expect(limiter.isRateLimited(TEST_CUID.USER_1, reservationId)).resolves.toBe(false);
		await expect(
			limiter.isEngagementRateLimited(TEST_CUID.USER_1, "2026-07-16", reservationId),
		).resolves.toBe(false);
	});
});
