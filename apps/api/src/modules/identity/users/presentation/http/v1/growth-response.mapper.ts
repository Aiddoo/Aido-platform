import type { GrowthSummaryResponse } from "@aido/api/contracts/admin";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { GrowthSummaryReadModel } from "../../../application/read-models/growth-summary.read-model.js";

export function toGrowthSummaryResponse(summary: GrowthSummaryReadModel): GrowthSummaryResponse {
  return {
    ...summary,
    cohortFrom: summary.cohortFrom.toString(),
    cohortTo: summary.cohortTo.toString(),
    measurementStartedAt:
      summary.measurementStartedAt == null ? null : toIsoString(summary.measurementStartedAt),
  };
}
