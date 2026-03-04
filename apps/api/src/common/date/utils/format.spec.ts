import {
	toDateString,
	toDateStringOrNull,
	toISOString,
	toISOStringOrNull,
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
	});
});
