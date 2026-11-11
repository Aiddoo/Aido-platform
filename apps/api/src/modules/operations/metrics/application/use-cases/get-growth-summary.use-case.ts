import type { ClockPort } from "#api/shared/application/ports/clock.port";

import {
  calculateStickiness,
  defaultCohortRange,
  toCohortMetric,
  toRetentionMetric,
} from "../../domain/growth-summary.domain-service.js";
import type { GrowthMetricsReaderPort } from "../ports/growth-metrics.reader.port.js";
import type { GrowthSummary } from "../read-models/growth-summary.read-model.js";

export interface GetGrowthSummaryQuery {
  readonly cohortFrom?: Temporal.PlainDate;
  readonly cohortTo?: Temporal.PlainDate;
}

export interface GetGrowthSummaryDependencies {
  readonly metricsReader: Pick<GrowthMetricsReaderPort, "getSummaryCounts">;
  readonly clock: ClockPort;
}

export class GetGrowthSummaryUseCase {
  readonly #dependencies: GetGrowthSummaryDependencies;

  constructor(dependencies: GetGrowthSummaryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetGrowthSummaryQuery): Promise<GrowthSummary> {
    const { metricsReader, clock } = this.#dependencies;
    const asOf = clock.now();
    const defaults = defaultCohortRange(asOf);
    const cohortFrom = query.cohortFrom ?? defaults.cohortFrom;
    const cohortTo = query.cohortTo ?? defaults.cohortTo;

    const counts = await metricsReader.getSummaryCounts({ cohortFrom, cohortTo, asOf });
    const hasMeasurement = counts.measurementStartedAt != null;

    return {
      cohortFrom,
      cohortTo,
      measurementStartedAt: counts.measurementStartedAt,
      totalActiveUsers: counts.totalActiveUsers,
      signups: counts.signups,
      dau: counts.dau,
      wau: counts.wau,
      mau: counts.mau,
      stickiness: calculateStickiness({ dau: counts.dau, mau: counts.mau }),
      activation24h: toCohortMetric(counts.activationEligible, counts.activationAchieved),
      d1: toRetentionMetric({
        hasMeasurement,
        eligible: counts.d1Eligible,
        achieved: counts.d1Achieved,
      }),
      d7: toRetentionMetric({
        hasMeasurement,
        eligible: counts.d7Eligible,
        achieved: counts.d7Achieved,
      }),
      d30: toRetentionMetric({
        hasMeasurement,
        eligible: counts.d30Eligible,
        achieved: counts.d30Achieved,
      }),
      d7RetainedActivatedUsers:
        hasMeasurement && counts.d7Eligible > 0 ? counts.d7RetainedActivatedUsers : null,
    };
  }
}
