/**
 * 기상청 API 상수 및 유틸 단위 테스트
 *
 * @description
 * getKmaBaseDateTime의 자정~새벽 경계 처리 검증.
 * jest.useFakeTimers로 시스템 시간을 고정하여 날짜 경계 테스트.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test kma.constants.spec
 * ```
 */

import { toCompactDateString } from "@/shared/domain/date/utils/format";
import { getKmaBaseDateTime } from "./kma.constants";

describe("getKmaBaseDateTime", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("새벽 1시 → 전날 base_date + 2300 base_time", () => {
		// Given: 2026-03-18 01:00 (로컬 시간)
		jest.setSystemTime(new Date(2026, 2, 18, 1, 0, 0));

		// When
		const result = getKmaBaseDateTime(new Date());

		// Then
		expect(result).toEqual({
			baseDate: "20260317",
			baseTime: "2300",
		});
	});

	it("새벽 2시 14분 → 아직 02시 발표 안 됨, 전날 2300", () => {
		// Given: 2026-03-18 02:14
		jest.setSystemTime(new Date(2026, 2, 18, 2, 14, 0));

		// When
		const result = getKmaBaseDateTime(new Date());

		// Then
		expect(result).toEqual({
			baseDate: "20260317",
			baseTime: "2300",
		});
	});

	it("새벽 2시 15분 → 02시 발표 사용 가능 (오늘 날짜)", () => {
		// Given: 2026-03-18 02:15
		jest.setSystemTime(new Date(2026, 2, 18, 2, 15, 0));

		// When
		const result = getKmaBaseDateTime(new Date());

		// Then
		expect(result).toEqual({
			baseDate: "20260318",
			baseTime: "0200",
		});
	});

	it("오후 3시 → 14시 발표 (오늘 날짜)", () => {
		// Given: 2026-03-18 15:00
		jest.setSystemTime(new Date(2026, 2, 18, 15, 0, 0));

		// When
		const result = getKmaBaseDateTime(new Date());

		// Then
		expect(result).toEqual({
			baseDate: "20260318",
			baseTime: "1400",
		});
	});

	it("23시 59분 → 23시 발표 (오늘 날짜)", () => {
		// Given: 2026-03-18 23:59
		jest.setSystemTime(new Date(2026, 2, 18, 23, 59, 0));

		// When
		const result = getKmaBaseDateTime(new Date());

		// Then
		expect(result).toEqual({
			baseDate: "20260318",
			baseTime: "2300",
		});
	});

	it("자정 정각 → 전날 2300", () => {
		// Given: 2026-03-19 00:00
		jest.setSystemTime(new Date(2026, 2, 19, 0, 0, 0));

		// When
		const result = getKmaBaseDateTime(new Date());

		// Then
		expect(result).toEqual({
			baseDate: "20260318",
			baseTime: "2300",
		});
	});

	it("월 경계: 4월 1일 새벽 0시 30분 → 3월 31일 2300", () => {
		// Given: 2026-04-01 00:30
		jest.setSystemTime(new Date(2026, 3, 1, 0, 30, 0));

		// When
		const result = getKmaBaseDateTime(new Date());

		// Then
		expect(result).toEqual({
			baseDate: "20260331",
			baseTime: "2300",
		});
	});

	it("연 경계: 1월 1일 새벽 1시 → 전년 12월 31일 2300", () => {
		// Given: 2027-01-01 01:00
		jest.setSystemTime(new Date(2027, 0, 1, 1, 0, 0));

		// When
		const result = getKmaBaseDateTime(new Date());

		// Then
		expect(result).toEqual({
			baseDate: "20261231",
			baseTime: "2300",
		});
	});
});

describe("toCompactDateString", () => {
	it("날짜를 YYYYMMDD 형식으로 변환해야 한다", () => {
		expect(toCompactDateString(new Date(2026, 2, 18))).toBe("20260318");
	});

	it("한 자리 월/일을 0으로 패딩해야 한다", () => {
		expect(toCompactDateString(new Date(2026, 0, 5))).toBe("20260105");
	});
});
