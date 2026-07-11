/**
 * previousIsoWeekRange 유틸 테스트
 *
 * @description
 * previousIsoWeekRange 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test range
 * ```
 */
import { previousIsoWeekRange } from "./range";

describe("previousIsoWeekRange", () => {
	it("월요일 기준 이전 주의 월~일 범위를 반환한다", () => {
		const result = previousIsoWeekRange(new Date("2024-01-15T00:00:00.000Z"));
		expect(result.start).toEqual(new Date("2024-01-08T00:00:00.000Z"));
		expect(result.end).toEqual(new Date("2024-01-15T00:00:00.000Z"));
		expect(result.isoYear).toBe(2024);
		expect(result.isoWeek).toBe(2);
	});

	it("주 중간일에 호출해도 올바른 범위를 반환한다", () => {
		const result = previousIsoWeekRange(new Date("2024-01-17T00:00:00.000Z"));
		expect(result.start).toEqual(new Date("2024-01-08T00:00:00.000Z"));
		expect(result.end).toEqual(new Date("2024-01-15T00:00:00.000Z"));
	});

	it("연말→연초 경계를 올바르게 처리한다", () => {
		const result = previousIsoWeekRange(new Date("2024-01-01T00:00:00.000Z"));
		expect(result.start).toEqual(new Date("2023-12-25T00:00:00.000Z"));
		expect(result.end).toEqual(new Date("2024-01-01T00:00:00.000Z"));
		expect(result.isoYear).toBe(2023);
		expect(result.isoWeek).toBe(52);
	});
});
