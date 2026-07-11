/**
 * report-period 도메인 서비스 단위 테스트
 *
 * - computePeriodLabel: 기간 라벨 형식(ko/en) 검증
 * - computeDateRange: 주간/월간 날짜 범위 계산 검증
 */

import { computeDateRange, computePeriodLabel } from "./report-period";

describe("computePeriodLabel — en 로케일", () => {
	it("en 주간 라벨은 'Week N, YYYY' 형식이다", () => {
		expect(computePeriodLabel("WEEKLY", 2026, 10, "en")).toBe("Week 10, 2026");
	});

	it("en 월간 라벨은 영어 월 이름을 사용한다", () => {
		expect(computePeriodLabel("MONTHLY", 2026, 3, "en")).toBe("March 2026");
	});

	it("locale 생략 시 한국어 라벨을 유지한다 (하위 호환)", () => {
		expect(computePeriodLabel("WEEKLY", 2026, 10)).toBe("2026년 10주차");
		expect(computePeriodLabel("MONTHLY", 2026, 3)).toBe("2026년 3월");
	});
});

describe("computePeriodLabel", () => {
	it("WEEKLY 타입일 때 '년 주차' 형식으로 반환해야 한다", () => {
		expect(computePeriodLabel("WEEKLY", 2026, 10)).toBe("2026년 10주차");
	});

	it("MONTHLY 타입일 때 '년 월' 형식으로 반환해야 한다", () => {
		expect(computePeriodLabel("MONTHLY", 2026, 3)).toBe("2026년 3월");
	});

	it("1주차를 올바르게 표현해야 한다", () => {
		expect(computePeriodLabel("WEEKLY", 2026, 1)).toBe("2026년 1주차");
	});
});

describe("computeDateRange", () => {
	it("WEEKLY 타입일 때 월요일 ~ 일요일 범위를 반환해야 한다", () => {
		const result = computeDateRange("WEEKLY", 2026, 10);

		expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(result.startDate < result.endDate).toBe(true);
	});

	it("MONTHLY 타입일 때 해당 월 1일 ~ 마지막 날 범위를 반환해야 한다", () => {
		const result = computeDateRange("MONTHLY", 2026, 3);

		expect(result.startDate).toBe("2026-03-01");
		expect(result.endDate).toBe("2026-03-31");
	});

	it("MONTHLY 타입으로 2월 범위를 올바르게 계산해야 한다 (28일/29일)", () => {
		const result = computeDateRange("MONTHLY", 2026, 2);

		expect(result.startDate).toBe("2026-02-01");
		expect(result.endDate).toBe("2026-02-28");
	});
});
