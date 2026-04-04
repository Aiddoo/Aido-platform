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
			expect(addMinutes(30, base)).toEqual(
				new Date("2026-03-03T12:30:00.000Z"),
			);
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

	describe("addMilliseconds", () => {
		it("지정 밀리초를 더한 시각 반환", () => {
			expect(addMilliseconds(1500, base)).toEqual(
				new Date("2026-03-03T12:00:01.500Z"),
			);
		});
	});

	describe("subtractSeconds", () => {
		it("지정 초를 뺀 시각 반환", () => {
			expect(subtractSeconds(30, base)).toEqual(
				new Date("2026-03-03T11:59:30.000Z"),
			);
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(subtractSeconds(60)).toEqual(new Date("2026-03-03T11:59:00.000Z"));
		});
	});

	describe("subtractDays", () => {
		it("지정 일수를 뺀 시각 반환", () => {
			expect(subtractDays(1, base)).toEqual(
				new Date("2026-03-02T12:00:00.000Z"),
			);
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(subtractDays(0)).toEqual(FROZEN_TIME);
		});
	});

	describe("subtractMilliseconds", () => {
		it("지정 밀리초를 뺀 시각 반환", () => {
			expect(subtractMilliseconds(500, base)).toEqual(
				new Date("2026-03-03T11:59:59.500Z"),
			);
		});

		it("from 미지정 시 현재 시각 기준", () => {
			expect(subtractMilliseconds(0)).toEqual(FROZEN_TIME);
		});
	});
});
