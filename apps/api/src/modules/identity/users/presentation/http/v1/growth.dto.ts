import { growthSummaryQuerySchema, growthSummaryResponseSchema } from "@aido/api/contracts/admin";
import type { z } from "zod";

export const GrowthSummaryQueryDto = growthSummaryQuerySchema.meta({
  id: "GrowthSummaryQueryDto",
  apiParameter: true,
});
export type GrowthSummaryQueryDto = z.infer<typeof GrowthSummaryQueryDto>;

export const GrowthSummaryResponseDto = growthSummaryResponseSchema.meta({
  id: "GrowthSummaryResponseDto",
});
export type GrowthSummaryResponseDto = z.infer<typeof GrowthSummaryResponseDto>;
