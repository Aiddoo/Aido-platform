export interface GrowthSummaryCounts {
  readonly measurementStartedAt: Temporal.Instant | null;
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

export abstract class GrowthMetricsReaderPort {
  abstract getSummaryCounts(params: {
    readonly cohortFrom: Temporal.PlainDate;
    readonly cohortTo: Temporal.PlainDate;
    readonly asOf: Temporal.Instant;
  }): Promise<GrowthSummaryCounts>;
}
