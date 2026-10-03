import { z } from 'zod';

export const weeklyAchievementSchema = z.object({
  id: z.number(),
  year: z.number(),
  week: z.number(),
  weekLabel: z.string(),
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  totalTodos: z.number(),
  completedTodos: z.number(),
  completionRate: z.number(),
  achievedAt: z.date(),
});

export type WeeklyAchievement = z.infer<typeof weeklyAchievementSchema>;

export const achievementSummarySchema = z.object({
  totalWeeks: z.number(),
  perfectWeeks: z.number(),
  currentStreak: z.number(),
  bestStreak: z.number(),
  averageRate: z.number(),
});

export type AchievementSummary = z.infer<typeof achievementSummarySchema>;

const achievementPaginationParamsSchema = z.object({
  year: z.number().int(),
  cursor: z.number().int().optional(),
  size: z.number().int().positive().optional(),
});
export type AchievementPaginationParams = z.infer<typeof achievementPaginationParamsSchema>;

export const weeklyAchievementsResultSchema = z.object({
  items: z.array(weeklyAchievementSchema),
  nextCursor: z.number().int().nullable(),
  hasNext: z.boolean(),
  summary: achievementSummarySchema,
});
export type WeeklyAchievementsResult = z.infer<typeof weeklyAchievementsResultSchema>;
