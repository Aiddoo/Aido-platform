/**
 * timezone 유틸 테스트
 *
 * @description
 * timezone 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test timezone
 * ```
 */
import {
	parseLocalDateTime,
	startOfDayInTimezone,
	todayInTimezone,
	toLocalTimeString,
} from "./timezone";

// 2026-03-03T12:00:00Z = KST 2026-03-03T21:00:00
beforeAll(() => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date("2026-03-03T12:00:00Z"));
});

afterAll(() => {
	jest.useRealTimers();
});

describe("timezone", () => {
	describe("todayInTimezone", () => {
		it("지정 타임존의 오늘을 UTC midnight Date로 반환", () => {
			// KST 기준 2026-03-03 → UTC midnight
			const result = todayInTimezone("Asia/Seoul");
			expect(result).toEqual(new Date("2026-03-03T00:00:00.000Z"));
		});

		it("기본값은 UTC", () => {
			const result = todayInTimezone();
			expect(result).toEqual(new Date("2026-03-03T00:00:00.000Z"));
		});
	});

	describe("parseLocalDateTime", () => {
		it("KST 14:00을 UTC 05:00으로 변환", () => {
			const result = parseLocalDateTime("2026-01-15", "14:00", "Asia/Seoul");
			expect(result).toEqual(new Date("2026-01-15T05:00:00.000Z"));
		});

		it("EST 14:00을 UTC 19:00으로 변환", () => {
			const result = parseLocalDateTime(
				"2026-01-15",
				"14:00",
				"America/New_York",
			);
			expect(result).toEqual(new Date("2026-01-15T19:00:00.000Z"));
		});

		it("기본 타임존(UTC)이면 시간 그대로 반환", () => {
			const result = parseLocalDateTime("2026-01-15", "14:00");
			expect(result).toEqual(new Date("2026-01-15T14:00:00.000Z"));
		});
	});

	describe("toLocalTimeString", () => {
		it("UTC Date를 KST 로컬 시간 문자열로 변환", () => {
			// UTC 05:00 = KST 14:00
			const utcDate = new Date("2026-01-15T05:00:00.000Z");
			expect(toLocalTimeString(utcDate, "Asia/Seoul")).toBe("14:00");
		});

		it("UTC Date를 EST 로컬 시간 문자열로 변환", () => {
			// UTC 19:00 = EST 14:00
			const utcDate = new Date("2026-01-15T19:00:00.000Z");
			expect(toLocalTimeString(utcDate, "America/New_York")).toBe("14:00");
		});

		it("parseLocalDateTime의 역변환이 정확", () => {
			// KST 14:00 → UTC → 다시 KST 14:00
			const utcDate = parseLocalDateTime("2026-01-15", "14:00", "Asia/Seoul");
			expect(toLocalTimeString(utcDate, "Asia/Seoul")).toBe("14:00");
		});

		it("기본 타임존(UTC)이면 UTC 시간 반환", () => {
			const utcDate = new Date("2026-01-15T14:00:00.000Z");
			expect(toLocalTimeString(utcDate)).toBe("14:00");
		});

		it("자정 시간을 올바르게 처리", () => {
			// UTC 15:00 = KST 00:00 (다음날)
			const utcDate = new Date("2026-01-15T15:00:00.000Z");
			expect(toLocalTimeString(utcDate, "Asia/Seoul")).toBe("00:00");
		});
	});

	describe("startOfDayInTimezone", () => {
		it("KST 기준 날짜의 UTC midnight 반환", () => {
			// UTC 20:00 = KST 05:00 (2/7)
			const date = new Date("2026-02-06T20:00:00Z");
			const result = startOfDayInTimezone(date, "Asia/Seoul");

			// KST 기준 2/7이므로 UTC 2/7 00:00 반환
			expect(result).toEqual(new Date("2026-02-07T00:00:00.000Z"));
		});

		it("UTC 기준 같은 날의 자정 반환", () => {
			const date = new Date("2026-02-06T15:30:00Z");
			const result = startOfDayInTimezone(date, "UTC");
			expect(result).toEqual(new Date("2026-02-06T00:00:00.000Z"));
		});
	});
});
