import {
  getWeeklyAchievementsQuerySchema,
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
  weeklyAchievementParamSchema,
  weeklyAchievementSchema,
  weeklyAchievementSummarySchema,
} from "@aido/api";
import type { z } from "zod";

export const GetWeeklyAchievementsQueryDto = getWeeklyAchievementsQuerySchema.meta({
  id: "GetWeeklyAchievementsQueryDto",
  apiParameter: true,
});
export type GetWeeklyAchievementsQueryDto = z.infer<typeof GetWeeklyAchievementsQueryDto>;

export const WeeklyAchievementParamDto = weeklyAchievementParamSchema.meta({
  id: "WeeklyAchievementParamDto",
  apiParameter: true,
});
export type WeeklyAchievementParamDto = z.infer<typeof WeeklyAchievementParamDto>;

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
