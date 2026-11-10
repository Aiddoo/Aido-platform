import type { GrowthCohortMetric } from "../../domain/growth-summary.domain-service.js";

export interface GrowthSummary {
  readonly cohortFrom: Temporal.PlainDate;
  readonly cohortTo: Temporal.PlainDate;
  readonly measurementStartedAt: Temporal.Instant | null;
  readonly totalActiveUsers: number;
  readonly signups: number;
  readonly dau: number;
  readonly wau: number;
  readonly mau: number;
  readonly stickiness: number;
  readonly activation24h: GrowthCohortMetric;
  readonly d1: GrowthCohortMetric | null;
  readonly d7: GrowthCohortMetric | null;
  readonly d30: GrowthCohortMetric | null;
  readonly d7RetainedActivatedUsers: number | null;
}
