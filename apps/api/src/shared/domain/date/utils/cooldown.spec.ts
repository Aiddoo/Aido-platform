/**
 * calculateCooldown 유틸 테스트
 *
 * @description
 * calculateCooldown 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test cooldown
 * ```
 */
import { calculateCooldown } from "./cooldown";

beforeAll(() => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date("2026-03-03T12:00:00Z"));
});

afterAll(() => {
	jest.useRealTimers();
});

describe("calculateCooldown", () => {
	it("lastActionTime이 null이면 비활성", () => {
		const result = calculateCooldown(null, 1);
		expect(result).toEqual({
			isActive: false,
			remainingSeconds: 0,
			endsAt: null,
		});
	});

	it("lastActionTime이 undefined이면 비활성", () => {
		const result = calculateCooldown(undefined, 1);
		expect(result).toEqual({
			isActive: false,
			remainingSeconds: 0,
			endsAt: null,
		});
	});

	it("쿨다운 중이면 active + remainingSeconds 반환", () => {
		// now = 12:00, lastAction = 11:30, cooldown = 1h → ends at 12:30
		const lastAction = new Date("2026-03-03T11:30:00Z");
		const result = calculateCooldown(lastAction, 1);

		expect(result.isActive).toBe(true);
		expect(result.remainingSeconds).toBe(1800); // 30분 = 1800초
		expect(result.endsAt).toEqual(new Date("2026-03-03T12:30:00Z"));
	});

	it("쿨다운이 종료되었으면 비활성", () => {
		// now = 12:00, lastAction = 10:00, cooldown = 1h → ended at 11:00
		const lastAction = new Date("2026-03-03T10:00:00Z");
		const result = calculateCooldown(lastAction, 1);

		expect(result).toEqual({
			isActive: false,
			remainingSeconds: 0,
			endsAt: null,
		});
	});

	it("남은 시간이 정수가 아니면 올림 처리", () => {
		// now = 12:00:00, lastAction = 11:59:59.500, cooldown = 1h
		// endsAt = 12:59:59.500, remaining = 3599.5초 → 올림 3600초
		const lastAction = new Date("2026-03-03T11:59:59.500Z");
		const result = calculateCooldown(lastAction, 1);

		expect(result.isActive).toBe(true);
		expect(result.remainingSeconds).toBe(3600);
	});
});
