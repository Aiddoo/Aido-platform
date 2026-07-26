/** AdminGrowthMetricsPort DI 토큰 */
export const ADMIN_GROWTH_METRICS = Symbol("ADMIN_GROWTH_METRICS");

export interface AdminGrowthSummaryCounts {
	readonly measurementStartedAt: Date | null;
	readonly totalActiveUsers: number;
	readonly signups: number;
	readonly dau: number;
	readonly wau: number;
	readonly mau: number;
	readonly activationEligible: number;
	readonly activationAchieved: number;
	readonly d1Eligible: number;
	readonly d1Achieved: number;
	readonly d7Eligible: number;
	readonly d7Achieved: number;
	readonly d30Eligible: number;
	readonly d30Achieved: number;
	readonly d7RetainedActivatedUsers: number;
}

export interface AdminGrowthMetricsPort {
	getSummary(input: {
		readonly cohortFrom: string;
		readonly cohortTo: string;
		readonly asOf: Date;
	}): Promise<AdminGrowthSummaryCounts>;
}
