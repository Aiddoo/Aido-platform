import { dailyCompletionSummarySchema, dailyCompletionsRangeResponseSchema } from "@aido/api";
import type { z } from "zod";

export const DailyCompletionSummaryDto = dailyCompletionSummarySchema.meta({
  id: "DailyCompletionSummaryDto",
});
export type DailyCompletionSummaryDto = z.infer<typeof DailyCompletionSummaryDto>;

export const DailyCompletionsRangeResponseDto = dailyCompletionsRangeResponseSchema.meta({
  id: "DailyCompletionsRangeResponseDto",
});
export type DailyCompletionsRangeResponseDto = z.infer<typeof DailyCompletionsRangeResponseDto>;
