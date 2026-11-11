import {
  getWeeklyAchievementsQuerySchema,
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
  weeklyAchievementParamSchema,
} from "@aido/api/contracts/weekly-achievement";
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

export const WeeklyAchievementListResponseDto = weeklyAchievementListResponseSchema.meta({
  id: "WeeklyAchievementListResponseDto",
});
export type WeeklyAchievementListResponseDto = z.infer<typeof WeeklyAchievementListResponseDto>;

export const WeeklyAchievementDetailResponseDto = weeklyAchievementDetailResponseSchema.meta({
  id: "WeeklyAchievementDetailResponseDto",
});
export type WeeklyAchievementDetailResponseDto = z.infer<typeof WeeklyAchievementDetailResponseDto>;
