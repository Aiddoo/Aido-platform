import {
  getWeeklyAchievementsQuerySchema,
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
  weeklyAchievementParamSchema,
  weeklyAchievementYearsResponseSchema,
} from "@aido/api/contracts/weekly-achievement/v1";
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

export const WeeklyAchievementYearsResponseDto = weeklyAchievementYearsResponseSchema.meta({
  id: "WeeklyAchievementYearsResponseDto",
});
export type WeeklyAchievementYearsResponseDto = z.infer<typeof WeeklyAchievementYearsResponseDto>;
