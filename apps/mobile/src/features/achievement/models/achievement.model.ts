import { z } from 'zod';

export const WeeklyAchievementSchema = z.object({
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

export type WeeklyAchievement = z.infer<typeof WeeklyAchievementSchema>;

export const AchievementSummarySchema = z.object({
  totalWeeks: z.number(),
  perfectWeeks: z.number(),
  currentStreak: z.number(),
  bestStreak: z.number(),
  averageRate: z.number(),
});

export type AchievementSummary = z.infer<typeof AchievementSummarySchema>;

export interface AchievementPaginationParams {
  year: number;
  cursor?: number;
  size?: number;
}

export interface WeeklyAchievementsResult {
  items: WeeklyAchievement[];
  nextCursor: number | null;
  hasNext: boolean;
  summary: AchievementSummary;
}
