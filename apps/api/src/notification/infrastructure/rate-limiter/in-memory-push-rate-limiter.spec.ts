import { InMemoryPushRateLimiter } from "./in-memory-push-rate-limiter";

describe("InMemoryPushRateLimiter engagement policy", () => {
	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
	});
	afterEach(() => jest.useRealTimers());

	it("현지 하루 최대 2회, 최소 4시간 간격을 원자적으로 적용한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		expect(await limiter.isEngagementRateLimited("user-1", "2026-07-15")).toBe(
			false,
		);
		expect(await limiter.isEngagementRateLimited("user-1", "2026-07-15")).toBe(
			true,
		);

		jest.advanceTimersByTime(4 * 60 * 60 * 1000);
		expect(await limiter.isEngagementRateLimited("user-1", "2026-07-15")).toBe(
			false,
		);

		jest.advanceTimersByTime(4 * 60 * 60 * 1000);
		expect(await limiter.isEngagementRateLimited("user-1", "2026-07-15")).toBe(
			true,
		);
		limiter.destroy();
	});

	it("48시간 지난 날짜별 참여 유도 카운터를 주기 정리한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const localDate = "2026-07-15";
		expect(await limiter.isEngagementRateLimited("user-1", localDate)).toBe(
			false,
		);
		jest.advanceTimersByTime(4 * 60 * 60 * 1000);
		expect(await limiter.isEngagementRateLimited("user-1", localDate)).toBe(
			false,
		);

		jest.advanceTimersByTime(49 * 60 * 60 * 1000);

		expect(await limiter.isEngagementRateLimited("user-1", localDate)).toBe(
			false,
		);
		limiter.destroy();
	});

	it("배치 요청의 입력 순서를 보존하고 참여 유도 정책을 함께 적용한다", async () => {
		const limiter = new InMemoryPushRateLimiter();
		const requests = [
			{ userId: "user-1", engagementLocalDate: "2026-07-15" },
			{ userId: "user-2" },
		] as const;

		await expect(limiter.reserveBatch(requests)).resolves.toEqual([
			false,
			false,
		]);
		await expect(limiter.reserveBatch(requests)).resolves.toEqual([
			true,
			false,
		]);

		limiter.destroy();
	});
});
