import type { GrowthSummaryResponse } from "@aido/api/contracts/admin";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { GrowthSummary } from "../../../application/read-models/growth-summary.read-model.js";

export function toGrowthSummaryResponse(summary: GrowthSummary): GrowthSummaryResponse {
  return {
    ...summary,
    cohortFrom: summary.cohortFrom.toString(),
    cohortTo: summary.cohortTo.toString(),
    measurementStartedAt:
      summary.measurementStartedAt == null ? null : toIsoString(summary.measurementStartedAt),
  };
}
