import {
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
  weeklyAchievementSchema,
  weeklyAchievementSummarySchema,
} from "@aido/api";
import type { z } from "zod";

export const WeeklyAchievementDto = weeklyAchievementSchema.meta({ id: "WeeklyAchievementDto" });
export type WeeklyAchievementDto = z.infer<typeof WeeklyAchievementDto>;

export const WeeklyAchievementSummaryDto = weeklyAchievementSummarySchema.meta({
  id: "WeeklyAchievementSummaryDto",
});
export type WeeklyAchievementSummaryDto = z.infer<typeof WeeklyAchievementSummaryDto>;

export const WeeklyAchievementListResponseDto = weeklyAchievementListResponseSchema.meta({
  id: "WeeklyAchievementListResponseDto",
});
export type WeeklyAchievementListResponseDto = z.infer<typeof WeeklyAchievementListResponseDto>;

export const WeeklyAchievementDetailResponseDto = weeklyAchievementDetailResponseSchema.meta({
  id: "WeeklyAchievementDetailResponseDto",
});
export type WeeklyAchievementDetailResponseDto = z.infer<typeof WeeklyAchievementDetailResponseDto>;
