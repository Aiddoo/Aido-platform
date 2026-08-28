import { InMemoryPushRateLimiter } from "./in-memory-push-rate-limiter";

describe("InMemoryPushRateLimiter engagement policy", () => {
	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
	});
	afterEach(() => jest.useRealTimers());

	it("현지 하루 최대 2회, 최소 4시간 간격을 원자적으로 적용한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		expect(await limiter.isEngagementRateLimited("user-1", "2026-07-15")).toBe(false);
		expect(await limiter.isEngagementRateLimited("user-1", "2026-07-15")).toBe(true);

		jest.advanceTimersByTime(4 * 60 * 60 * 1000);
		expect(await limiter.isEngagementRateLimited("user-1", "2026-07-15")).toBe(false);

		jest.advanceTimersByTime(4 * 60 * 60 * 1000);
		expect(await limiter.isEngagementRateLimited("user-1", "2026-07-15")).toBe(true);
		limiter.destroy();
	});

	it("48시간 지난 날짜별 참여 유도 카운터를 주기 정리한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const localDate = "2026-07-15";
		expect(await limiter.isEngagementRateLimited("user-1", localDate)).toBe(false);
		jest.advanceTimersByTime(4 * 60 * 60 * 1000);
		expect(await limiter.isEngagementRateLimited("user-1", localDate)).toBe(false);

		jest.advanceTimersByTime(49 * 60 * 60 * 1000);

		expect(await limiter.isEngagementRateLimited("user-1", localDate)).toBe(false);
		limiter.destroy();
	});

	it("배치 요청의 입력 순서를 보존하고 참여 유도 정책을 함께 적용한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const requests = [
			{ userId: "user-1", engagementLocalDate: "2026-07-15" },
			{ userId: "user-2" },
		] as const;

		await expect(limiter.reserveBatch(requests)).resolves.toEqual([false, false]);
		await expect(limiter.reserveBatch(requests)).resolves.toEqual([true, false]);

		limiter.destroy();
	});

	it("같은 dispatch 예약은 재시도와 새 publication generation에서도 한 번만 소비한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const request = {
			userId: "user-1",
			engagementLocalDate: "2026-07-15",
			reservationId: "push-delivery-501",
		} as const;

		await expect(limiter.reserveBatch([request])).resolves.toEqual([false]);
		await expect(limiter.reserveBatch([request])).resolves.toEqual([false]);
		await expect(
			limiter.reserveBatch([{ ...request, reservationId: "push-delivery-502" }]),
		).resolves.toEqual([true]);

		limiter.destroy();
	});

	it("engagement 제한은 Redis 계약과 동일하게 general quota를 소비하지 않는다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const localDate = "2026-07-15";
		await limiter.isEngagementRateLimited("user-1", localDate);

		await expect(
			limiter.reserveBatch([
				{
					userId: "user-1",
					engagementLocalDate: localDate,
					reservationId: "push-delivery-limited",
				},
			]),
		).resolves.toEqual([true]);
		for (let index = 0; index < 15; index += 1) {
			await expect(limiter.isRateLimited("user-1")).resolves.toBe(false);
		}
		await expect(limiter.isRateLimited("user-1")).resolves.toBe(true);

		limiter.destroy();
	});

	it("단건 일반·engagement 단계도 같은 dispatch 예약을 각각 재사용한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const reservationId = "push-delivery-601";

		await expect(limiter.isRateLimited("user-1", reservationId)).resolves.toBe(false);
		await expect(
			limiter.isEngagementRateLimited("user-1", "2026-07-15", reservationId),
		).resolves.toBe(false);
		await expect(limiter.isRateLimited("user-1", reservationId)).resolves.toBe(false);
		await expect(
			limiter.isEngagementRateLimited("user-1", "2026-07-15", reservationId),
		).resolves.toBe(false);

		limiter.destroy();
	});

	it("batch 예약 marker는 general window와 현지 날짜가 바뀌어도 같은 dispatch를 재사용한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const original = {
			userId: "user-1",
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

		limiter.destroy();
	});

	it("단건 general 예약 직후 crash한 재시도는 window가 지나도 quota를 다시 쓰지 않는다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const reservationId = "push-delivery-general-phase";
		await expect(limiter.isRateLimited("user-1", reservationId)).resolves.toBe(false);

		jest.advanceTimersByTime(2 * 60 * 60 * 1000);
		for (let index = 0; index < 15; index += 1) {
			await expect(limiter.isRateLimited("user-1")).resolves.toBe(false);
		}
		await expect(limiter.isRateLimited("user-1")).resolves.toBe(true);
		await expect(limiter.isRateLimited("user-1", reservationId)).resolves.toBe(false);
		await expect(
			limiter.isEngagementRateLimited("user-1", "2026-07-16", reservationId),
		).resolves.toBe(false);

		limiter.destroy();
	});
});
