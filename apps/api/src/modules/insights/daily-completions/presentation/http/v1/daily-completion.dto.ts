import {
  dailyCompletionSummarySchema,
  dailyCompletionsRangeResponseSchema,
  getDailyCompletionsRangeSchema,
} from "@aido/api";
import type { z } from "zod";

export const GetDailyCompletionsRangeDto = getDailyCompletionsRangeSchema.meta({
  id: "GetDailyCompletionsRangeDto",
  apiParameter: true,
});
export type GetDailyCompletionsRangeDto = z.infer<typeof GetDailyCompletionsRangeDto>;

export const DailyCompletionSummaryDto = dailyCompletionSummarySchema.meta({
  id: "DailyCompletionSummaryDto",
});
export type DailyCompletionSummaryDto = z.infer<typeof DailyCompletionSummaryDto>;

export const DailyCompletionsRangeResponseDto = dailyCompletionsRangeResponseSchema.meta({
  id: "DailyCompletionsRangeResponseDto",
});
export type DailyCompletionsRangeResponseDto = z.infer<typeof DailyCompletionsRangeResponseDto>;
