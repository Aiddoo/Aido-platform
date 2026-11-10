import {
  dailyCompletionsRangeResponseSchema,
  getDailyCompletionsRangeSchema,
} from "@aido/api/contracts/daily-completion";
import type { z } from "zod";

export const GetDailyCompletionsRangeDto = getDailyCompletionsRangeSchema.meta({
  id: "GetDailyCompletionsRangeDto",
  apiParameter: true,
});
export type GetDailyCompletionsRangeDto = z.infer<typeof GetDailyCompletionsRangeDto>;

export const DailyCompletionsRangeResponseDto = dailyCompletionsRangeResponseSchema.meta({
  id: "DailyCompletionsRangeResponseDto",
});
export type DailyCompletionsRangeResponseDto = z.infer<typeof DailyCompletionsRangeResponseDto>;
