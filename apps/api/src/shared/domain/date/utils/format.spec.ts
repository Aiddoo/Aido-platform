/**
 * format 유틸 테스트
 *
 * @description
 * format 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test format
 * ```
 */
import {
	toCompactDateHourString,
	toCompactDateString,
	toDateString,
	toDateStringOrNull,
	toISOString,
	toISOStringOrNull,
	toIsoMonthId,
	toIsoWeekId,
} from "./format";

const FROZEN_TIME = new Date("2026-03-04T12:00:00.000Z");

beforeAll(() => {
	jest.useFakeTimers();
	jest.setSystemTime(FROZEN_TIME);
});

afterAll(() => {
	jest.useRealTimers();
});

describe("format", () => {
	describe("toISOString", () => {
		it("Date를 ISO 8601 문자열로 변환한다", () => {
			expect(toISOString(FROZEN_TIME)).toBe("2026-03-04T12:00:00.000Z");
		});
	});

	describe("toDateString", () => {
		it("Date를 YYYY-MM-DD 문자열로 변환한다", () => {
			expect(toDateString(FROZEN_TIME)).toBe("2026-03-04");
		});
	});

	describe("toISOStringOrNull", () => {
		it("Date가 있으면 ISO 문자열을 반환한다", () => {
			expect(toISOStringOrNull(FROZEN_TIME)).toBe("2026-03-04T12:00:00.000Z");
		});

		it("null이면 null을 반환한다", () => {
			expect(toISOStringOrNull(null)).toBeNull();
		});
	});

	describe("toDateStringOrNull", () => {
		it("Date가 있으면 YYYY-MM-DD를 반환한다", () => {
			expect(toDateStringOrNull(FROZEN_TIME)).toBe("2026-03-04");
		});

		it("null이면 null을 반환한다", () => {
			expect(toDateStringOrNull(null)).toBeNull();
		});
	});

	describe("toCompactDateString", () => {
		it("Date를 YYYYMMDD 문자열로 변환한다", () => {
			expect(toCompactDateString(new Date(2026, 2, 18))).toBe("20260318");
		});

		it("한 자리 월/일을 0으로 패딩한다", () => {
			expect(toCompactDateString(new Date(2026, 0, 5))).toBe("20260105");
		});
	});

	describe("toCompactDateHourString", () => {
		it("Date를 YYYYMMDDHH 문자열로 변환한다", () => {
			expect(toCompactDateHourString(new Date(2026, 6, 15, 14, 30))).toBe("2026071514");
		});

		it("자정을 00으로 패딩한다", () => {
			expect(toCompactDateHourString(new Date(2026, 0, 1, 0, 0))).toBe("2026010100");
		});
	});

	describe("toIsoWeekId", () => {
		it("ISO 주번호 형식 문자열을 반환한다", () => {
			// 2026-03-04 = 2026-W10
			expect(toIsoWeekId(FROZEN_TIME)).toBe("2026-W10");
		});

		it("인수 없이 호출하면 현재 시간 기준으로 반환한다", () => {
			expect(toIsoWeekId()).toBe("2026-W10");
		});

		it("연말/연초 ISO 주번호를 올바르게 처리한다", () => {
			// 2025-12-29(월) = ISO 2026-W01
			const yearEnd = new Date("2025-12-29T00:00:00.000Z");
			expect(toIsoWeekId(yearEnd)).toBe("2026-W01");
		});

		it("1월 초에도 이전 연도의 주번호를 올바르게 반환한다", () => {
			// 2026-01-01(목) = ISO 2026-W01
			const newYear = new Date("2026-01-01T00:00:00.000Z");
			expect(toIsoWeekId(newYear)).toBe("2026-W01");
		});

		it("한 자리 주번호를 0으로 패딩한다", () => {
			// 2026-01-05(월) = ISO 2026-W02
			const week2 = new Date("2026-01-05T00:00:00.000Z");
			expect(toIsoWeekId(week2)).toBe("2026-W02");
		});

		it("tz 전달 시 해당 타임존 기준으로 주차를 계산한다", () => {
			// UTC 일요일 16:00 = KST 월요일 01:00 → 주차가 달라야 함
			const utcSunday = new Date("2026-03-15T16:00:00.000Z");
			expect(toIsoWeekId(utcSunday)).toBe("2026-W11"); // UTC 일요일 = W11
			expect(toIsoWeekId(utcSunday, "Asia/Seoul")).toBe("2026-W12"); // KST 월요일 = W12
		});

		it("tz 없이 호출하면 기존처럼 UTC 기준이다", () => {
			const utcSunday = new Date("2026-03-15T16:00:00.000Z");
			expect(toIsoWeekId(utcSunday)).toBe("2026-W11");
		});
	});

	describe("toIsoMonthId", () => {
		it("ISO 월 식별자를 반환한다", () => {
			expect(toIsoMonthId(FROZEN_TIME)).toBe("2026-M03");
		});

		it("tz 전달 시 해당 타임존 기준으로 월을 계산한다", () => {
			// UTC 3/31 16:00 = KST 4/1 01:00 → 월이 달라야 함
			const utcMar31 = new Date("2026-03-31T16:00:00.000Z");
			expect(toIsoMonthId(utcMar31)).toBe("2026-M03"); // UTC 3월
			expect(toIsoMonthId(utcMar31, "Asia/Seoul")).toBe("2026-M04"); // KST 4월
		});
	});
});
