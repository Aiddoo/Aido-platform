/**
 * arithmetic 유틸 테스트
 *
 * @description
 * arithmetic 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test arithmetic
 * ```
 */
import {
	addDays,
	addMilliseconds,
	addMinutes,
	addMonths,
	subtractDays,
	subtractMilliseconds,
	subtractSeconds,
} from "./arithmetic";

const FROZEN_TIME = new Date("2026-03-03T12:00:00.000Z");

beforeAll(() => {
	jest.useFakeTimers();
	jest.setSystemTime(FROZEN_TIME);
});

afterAll(() => {
	jest.useRealTimers();
});

describe("arithmetic", () => {
	const base = new Date("2026-03-03T12:00:00.000Z");

	describe("addMinutes", () => {
		it("지정 분을 더한 시각 반환", () => {
			expect(addMinutes(30, base)).toEqual(new Date("2026-03-03T12:30:00.000Z"));
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(addMinutes(10)).toEqual(new Date("2026-03-03T12:10:00.000Z"));
		});
	});

	describe("addDays", () => {
		it("지정 일수를 더한 시각 반환", () => {
			expect(addDays(5, base)).toEqual(new Date("2026-03-08T12:00:00.000Z"));
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(addDays(1)).toEqual(new Date("2026-03-04T12:00:00.000Z"));
		});
	});

	describe("addMonths", () => {
		it("지정 개월을 더한 시각 반환", () => {
			expect(addMonths(1, base)).toEqual(new Date("2026-04-03T12:00:00.000Z"));
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(addMonths(1)).toEqual(new Date("2026-04-03T12:00:00.000Z"));
		});

		it("음수 입력 시 이전 달로 이동", () => {
			expect(addMonths(-2, base)).toEqual(new Date("2026-01-03T12:00:00.000Z"));
		});

		it("연도 경계를 넘어서도 정상 동작", () => {
			const dec = new Date("2026-12-15T00:00:00.000Z");
			expect(addMonths(1, dec)).toEqual(new Date("2027-01-15T00:00:00.000Z"));
		});

		it("말일을 넘지 않도록 clamp (1월 31일 + 1개월 = 2월 말일)", () => {
			const jan31 = new Date("2026-01-31T00:00:00.000Z");
			expect(addMonths(1, jan31)).toEqual(new Date("2026-02-28T00:00:00.000Z"));
		});

		it("윤년 2월 29일 + 1개월 = 3월 29일", () => {
			const feb29 = new Date("2024-02-29T00:00:00.000Z");
			expect(addMonths(1, feb29)).toEqual(new Date("2024-03-29T00:00:00.000Z"));
		});
	});

	describe("addMilliseconds", () => {
		it("지정 밀리초를 더한 시각 반환", () => {
			expect(addMilliseconds(1500, base)).toEqual(new Date("2026-03-03T12:00:01.500Z"));
		});
	});

	describe("subtractSeconds", () => {
		it("지정 초를 뺀 시각 반환", () => {
			expect(subtractSeconds(30, base)).toEqual(new Date("2026-03-03T11:59:30.000Z"));
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(subtractSeconds(60)).toEqual(new Date("2026-03-03T11:59:00.000Z"));
		});
	});

	describe("subtractDays", () => {
		it("지정 일수를 뺀 시각 반환", () => {
			expect(subtractDays(1, base)).toEqual(new Date("2026-03-02T12:00:00.000Z"));
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(subtractDays(0)).toEqual(FROZEN_TIME);
		});
	});

	describe("subtractMilliseconds", () => {
		it("지정 밀리초를 뺀 시각 반환", () => {
			expect(subtractMilliseconds(500, base)).toEqual(new Date("2026-03-03T11:59:59.500Z"));
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(subtractMilliseconds(0)).toEqual(FROZEN_TIME);
		});
	});
});
