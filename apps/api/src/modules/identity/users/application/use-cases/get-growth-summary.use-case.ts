import type { TodoActivationReaderPort } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import {
  activationWindowOf,
  calculateStickiness,
  defaultCohortRange,
  tallyGrowthCohort,
  toCohortMetric,
  toRetentionMetric,
} from "../../domain/growth-summary.domain-service.js";
import type { GrowthMetricsReaderPort } from "../ports/growth-metrics.reader.port.js";
import type { GrowthSummaryReadModel } from "../read-models/growth-summary.read-model.js";

export interface GetGrowthSummaryQuery {
  readonly cohortFrom?: Temporal.PlainDate;
  readonly cohortTo?: Temporal.PlainDate;
}

export interface GetGrowthSummaryDependencies {
  readonly growthMetricsReader: Pick<GrowthMetricsReaderPort, "getActivity" | "listCohortSignups">;
  readonly todoActivationReader: Pick<TodoActivationReaderPort, "listActivatedUserIds">;
  readonly clock: ClockPort;
}

// 가입·활동일은 identity 행으로, 24시간 안 할 일 생성·완료는 planning 조회 포트로 cohort 전체를 한 번에 센다
export class GetGrowthSummaryUseCase {
  readonly #dependencies: GetGrowthSummaryDependencies;

  constructor(dependencies: GetGrowthSummaryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetGrowthSummaryQuery): Promise<GrowthSummaryReadModel> {
    const { growthMetricsReader, todoActivationReader, clock } = this.#dependencies;
    const asOf = clock.now();
    const defaults = defaultCohortRange(asOf);
    const cohortFrom = query.cohortFrom ?? defaults.cohortFrom;
    const cohortTo = query.cohortTo ?? defaults.cohortTo;

    const activity = await growthMetricsReader.getActivity({ cohortFrom, cohortTo });
    const signups = await growthMetricsReader.listCohortSignups({ cohortFrom, cohortTo, asOf });
    const activatedUserIds = await todoActivationReader.listActivatedUserIds(
      signups.map((signup) => ({
        userId: signup.userId,
        ...activationWindowOf(signup.signedUpAt),
      })),
    );
    const activated = new Set(activatedUserIds.map((userId) => userId.value));
    const tally = tallyGrowthCohort({
      signups: signups.map((signup) => ({
        ...signup,
        activated: activated.has(signup.userId.value),
      })),
      measurementStartedAt: activity.measurementStartedAt,
      asOf,
    });
    const hasMeasurement = activity.measurementStartedAt != null;

    return {
      cohortFrom,
      cohortTo,
      measurementStartedAt: activity.measurementStartedAt,
      totalActiveUsers: activity.totalActiveUsers,
      signups: tally.signups,
      dau: activity.dau,
      wau: activity.wau,
      mau: activity.mau,
      stickiness: calculateStickiness({ dau: activity.dau, mau: activity.mau }),
      activation24h: toCohortMetric(tally.activation.eligible, tally.activation.achieved),
      d1: toRetentionMetric({ hasMeasurement, ...tally.retention.d1 }),
      d7: toRetentionMetric({ hasMeasurement, ...tally.retention.d7 }),
      d30: toRetentionMetric({ hasMeasurement, ...tally.retention.d30 }),
      d7RetainedActivatedUsers:
        hasMeasurement && tally.retention.d7.eligible > 0 ? tally.d7RetainedActivatedUsers : null,
    };
  }
}
