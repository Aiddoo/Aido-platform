/**
 * expandRecurringDates 도메인 서비스 단위 테스트
 *
 * GWT 패턴 — 순수 함수 날짜 확장 규칙 검증
 */

import { expandRecurringDates } from "./expand-recurring-dates";

describe("expandRecurringDates — 반복 날짜 확장", () => {
	it("범위 내에서 지정 요일의 날짜만 반환한다", () => {
		// Given - 2026-03-01(일) ~ 2026-03-14(토), 월/수/금
		// When
		const dates = expandRecurringDates("2026-03-01", "2026-03-14", ["MON", "WED", "FRI"]);

		// Then - 2주간 월/수/금 = 6개
		expect(dates).toEqual([
			"2026-03-02",
			"2026-03-04",
			"2026-03-06",
			"2026-03-09",
			"2026-03-11",
			"2026-03-13",
		]);
	});

	it("시작일과 종료일이 같고 요일이 일치하면 해당 날짜 하나를 반환한다 (경계 포함)", () => {
		// Given - 2026-03-02는 월요일
		// When
		const dates = expandRecurringDates("2026-03-02", "2026-03-02", ["MON"]);

		// Then
		expect(dates).toEqual(["2026-03-02"]);
	});

	it("범위 내에 일치하는 요일이 없으면 빈 배열을 반환한다", () => {
		// Given - 2026-03-02(월)~2026-03-03(화), 일요일만 선택
		// When
		const dates = expandRecurringDates("2026-03-02", "2026-03-03", ["SUN"]);

		// Then
		expect(dates).toEqual([]);
	});

	it("모든 요일을 선택하면 범위의 전체 날짜를 반환한다", () => {
		// Given & When
		const dates = expandRecurringDates("2026-03-02", "2026-03-08", [
			"MON",
			"TUE",
			"WED",
			"THU",
			"FRI",
			"SAT",
			"SUN",
		]);

		// Then - 7일 전부
		expect(dates).toHaveLength(7);
	});
});
