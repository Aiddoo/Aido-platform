export interface GrowthSummaryInput {
  readonly cohortFrom?: string;
  readonly cohortTo?: string;
}

export interface GrowthCohortMetric {
  readonly eligible: number;
  readonly achieved: number;
  readonly rate: number;
}

export interface AdminGrowthSummary {
  readonly cohortFrom: string;
  readonly cohortTo: string;
  readonly measurementStartedAt: Date | null;
  readonly totalActiveUsers: number;
  readonly signups: number;
  readonly dau: number;
  readonly wau: number;
  readonly mau: number;
  readonly activation24h: GrowthCohortMetric;
  readonly d1: GrowthCohortMetric | null;
  readonly d7: GrowthCohortMetric | null;
  readonly d30: GrowthCohortMetric | null;
  readonly d7RetainedActivatedUsers: number | null;
}
