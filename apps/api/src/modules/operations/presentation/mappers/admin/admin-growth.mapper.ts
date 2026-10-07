import type { GrowthSummaryResponse } from "@aido/api";

import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { AdminGrowthSummary } from "../../../application/read-models/admin/admin-growth.read-model.js";

export function toAdminGrowthResponse(summary: AdminGrowthSummary): GrowthSummaryResponse {
  return { ...summary, measurementStartedAt: toISOStringOrNull(summary.measurementStartedAt) };
}
