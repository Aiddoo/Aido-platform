/**
 * calculateConsistencyScore 유틸 테스트
 *
 * @description
 * calculateConsistencyScore 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test score-calculator
 * ```
 */
import { calculateConsistencyScore, calculateProductivityScore } from "./score-calculator";

describe("calculateConsistencyScore", () => {
	it("매일 동일한 할 일 수면 100을 반환해야 한다", () => {
		// Given
		const dailyCounts = [3, 3, 3, 3, 3];

		// When
		const score = calculateConsistencyScore(dailyCounts);

		// Then
		expect(score).toBe(100);
	});

	it("편차가 큰 경우 낮은 점수를 반환해야 한다", () => {
		// Given
		const dailyCounts = [0, 0, 0, 0, 15];

		// When
		const score = calculateConsistencyScore(dailyCounts);

		// Then
		expect(score).toBeLessThan(30);
	});

	it("빈 배열이면 0을 반환해야 한다", () => {
		// Given
		const dailyCounts: number[] = [];

		// When
		const score = calculateConsistencyScore(dailyCounts);

		// Then
		expect(score).toBe(0);
	});

	it("모든 값이 0이면 0을 반환해야 한다", () => {
		// Given
		const dailyCounts = [0, 0, 0];

		// When
		const score = calculateConsistencyScore(dailyCounts);

		// Then
		expect(score).toBe(0);
	});

	it("단일 값이면 100을 반환해야 한다 (편차 없음)", () => {
		// Given
		const dailyCounts = [5];

		// When
		const score = calculateConsistencyScore(dailyCounts);

		// Then
		expect(score).toBe(100);
	});

	it("적당한 편차면 중간 점수를 반환해야 한다", () => {
		// Given
		const dailyCounts = [2, 3, 4, 3, 2];

		// When
		const score = calculateConsistencyScore(dailyCounts);

		// Then
		expect(score).toBeGreaterThan(50);
		expect(score).toBeLessThan(100);
	});
});

describe("calculateProductivityScore", () => {
	it("모든 지표가 최대일 때 높은 점수를 반환해야 한다", () => {
		// Given
		const input = {
			completionRate: 100,
			consistencyScore: 100,
			streakDays: 7,
			periodDays: 7,
			rateChange: 10,
		};

		// When
		const score = calculateProductivityScore(input);

		// Then
		expect(score).toBeGreaterThanOrEqual(90);
	});

	it("모든 지표가 0일 때 낮은 점수를 반환해야 한다", () => {
		// Given
		const input = {
			completionRate: 0,
			consistencyScore: 0,
			streakDays: 0,
			periodDays: 7,
			rateChange: -10,
		};

		// When
		const score = calculateProductivityScore(input);

		// Then
		expect(score).toBeLessThan(10);
	});

	it("rateChange가 null이면 추세 보너스 없이 계산해야 한다", () => {
		// Given
		const withNull = {
			completionRate: 70,
			consistencyScore: 70,
			streakDays: 3,
			periodDays: 7,
			rateChange: null,
		};

		// When
		const score = calculateProductivityScore(withNull);

		// Then
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(100);
	});

	it("periodDays가 0이면 스트릭 비율을 0으로 처리해야 한다", () => {
		// Given
		const input = {
			completionRate: 50,
			consistencyScore: 50,
			streakDays: 5,
			periodDays: 0,
			rateChange: null,
		};

		// When
		const score = calculateProductivityScore(input);

		// Then
		expect(score).toBeGreaterThan(0);
	});
});
