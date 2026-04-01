/**
 * 보고서 점수 계산기
 *
 * 일관성 점수(consistencyScore)와 생산성 점수(productivityScore)를 계산합니다.
 * 순수 함수로 구성되어 외부 의존성이 없습니다.
 */

/**
 * 일관성 점수 계산 (0-100)
 *
 * 일별 할 일 수의 변동계수(CV) 기반.
 * 매일 동일한 수 → 100, 편차 클수록 → 0에 수렴.
 */
export function calculateConsistencyScore(dailyCounts: number[]): number {
	if (dailyCounts.length === 0) {
		return 0;
	}

	const mean = dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length;
	if (mean === 0) {
		return 0;
	}

	const variance =
		dailyCounts.reduce((sum, count) => sum + (count - mean) ** 2, 0) /
		dailyCounts.length;
	const cv = Math.sqrt(variance) / mean;

	return Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
}

export interface ProductivityScoreInput {
	readonly completionRate: number;
	readonly consistencyScore: number;
	readonly streakDays: number;
	readonly periodDays: number;
	readonly rateChange: number | null;
}

/**
 * 생산성 점수 계산 (0-100)
 *
 * 가중 합산: 달성률(40%) + 일관성(30%) + 스트릭 비율(20%) + 추세(10%)
 */
export function calculateProductivityScore(
	input: ProductivityScoreInput,
): number {
	const streakRatio =
		input.periodDays > 0
			? Math.min(input.streakDays / input.periodDays, 1) * 100
			: 0;
	const trendBonus =
		input.rateChange !== null
			? Math.min(Math.max(input.rateChange, -10), 10)
			: 0;

	return Math.round(
		input.completionRate * 0.4 +
			input.consistencyScore * 0.3 +
			streakRatio * 0.2 +
			(50 + trendBonus * 5) * 0.1,
	);
}
