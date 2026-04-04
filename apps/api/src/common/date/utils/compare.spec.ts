/**
 * compare 유틸 테스트
 *
 * @description
 * compare 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test compare
 * ```
 */
import {
	diffInDays,
	diffInSeconds,
	isAfter,
	isBefore,
	isExpired,
	isSame,
	isSameDay,
} from "./compare";

beforeAll(() => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date("2026-06-15T12:00:00Z"));
});

afterAll(() => {
	jest.useRealTimers();
});

describe("compare", () => {
	describe("isExpired", () => {
		it("과거 날짜면 true", () => {
			const past = new Date("2020-01-01T00:00:00Z");
			expect(isExpired(past)).toBe(true);
		});

		it("미래 날짜면 false", () => {
			const future = new Date("2099-12-31T23:59:59Z");
			expect(isExpired(future)).toBe(false);
		});
	});

	describe("isBefore", () => {
		it("이전이면 true", () => {
			const earlier = new Date("2026-01-01T00:00:00Z");
			const later = new Date("2026-01-02T00:00:00Z");
			expect(isBefore(earlier, later)).toBe(true);
		});

		it("이후면 false", () => {
			const earlier = new Date("2026-01-01T00:00:00Z");
			const later = new Date("2026-01-02T00:00:00Z");
			expect(isBefore(later, earlier)).toBe(false);
		});

		it("같으면 false", () => {
			const date = new Date("2026-01-01T00:00:00Z");
			expect(isBefore(date, date)).toBe(false);
		});
	});

	describe("isAfter", () => {
		it("이후면 true", () => {
			const earlier = new Date("2026-01-01T00:00:00Z");
			const later = new Date("2026-01-02T00:00:00Z");
			expect(isAfter(later, earlier)).toBe(true);
		});

		it("이전이면 false", () => {
			const earlier = new Date("2026-01-01T00:00:00Z");
			const later = new Date("2026-01-02T00:00:00Z");
			expect(isAfter(earlier, later)).toBe(false);
		});
	});

	describe("isSame", () => {
		it("같으면 true", () => {
			const a = new Date("2026-01-01T12:00:00Z");
			const b = new Date("2026-01-01T12:00:00Z");
			expect(isSame(a, b)).toBe(true);
		});

		it("다르면 false", () => {
			const a = new Date("2026-01-01T12:00:00Z");
			const b = new Date("2026-01-01T12:00:01Z");
			expect(isSame(a, b)).toBe(false);
		});
	});

	describe("isSameDay", () => {
		it("같은 날(시간 다름)이면 true", () => {
			const morning = new Date("2026-01-01T06:00:00Z");
			const evening = new Date("2026-01-01T23:59:59Z");
			expect(isSameDay(morning, evening)).toBe(true);
		});

		it("다른 날이면 false", () => {
			const day1 = new Date("2026-01-01T23:59:59Z");
			const day2 = new Date("2026-01-02T00:00:00Z");
			expect(isSameDay(day1, day2)).toBe(false);
		});
	});

	describe("diffInDays", () => {
		it("두 날짜 차이 일수 반환", () => {
			const start = new Date("2026-01-01T00:00:00Z");
			const end = new Date("2026-01-11T00:00:00Z");
			expect(diffInDays(end, start)).toBe(10);
		});

		it("역순이면 음수 반환", () => {
			const start = new Date("2026-01-01T00:00:00Z");
			const end = new Date("2026-01-11T00:00:00Z");
			expect(diffInDays(start, end)).toBe(-10);
		});
	});

	describe("diffInSeconds", () => {
		it("두 날짜 차이 초 반환", () => {
			const start = new Date("2026-01-01T00:00:00Z");
			const end = new Date("2026-01-01T00:05:00Z");
			expect(diffInSeconds(end, start)).toBe(300);
		});
	});
});
