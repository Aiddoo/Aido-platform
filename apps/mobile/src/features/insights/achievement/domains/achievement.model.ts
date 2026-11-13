import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

export const weeklyAchievementSchema = z.object({
  id: z.int(),
  year: z.int(),
  week: z.int().min(1).max(53),
  dateRange: z.object({ startDate: dateKeySchema, endDate: dateKeySchema }),
  totalTodos: z.int().nonnegative(),
  completedTodos: z.int().nonnegative(),
  completionRate: z.number().min(0).max(100),
  achievedAt: instantSchema,
});
export type WeeklyAchievement = z.infer<typeof weeklyAchievementSchema>;

const weeklyAchievementSummarySchema = z.object({
  totalWeeks: z.int().nonnegative(),
  perfectWeeks: z.int().nonnegative(),
  currentStreak: z.int().nonnegative(),
  bestStreak: z.int().nonnegative(),
  averageRate: z.number().min(0).max(100),
});

export const weeklyAchievementPageSchema = cursorPageSchema(
  weeklyAchievementSchema,
  z.int(),
).extend({
  summary: weeklyAchievementSummarySchema,
});
export type WeeklyAchievementPage = z.infer<typeof weeklyAchievementPageSchema>;

const badgeTypeSchema = z.enum(['perfect', 'almost', 'completed']);
export type BadgeType = z.infer<typeof badgeTypeSchema>;

const PERFECT_COMPLETION_RATE = 100;
const ALMOST_COMPLETION_RATE = 90;

// 완료율 100%는 빈틈없는 한 주, 90% 이상은 아깝다 한 끗, 나머지는 꾸준한 한 걸음
export function getBadgeType(achievement: WeeklyAchievement): BadgeType {
  if (achievement.completionRate >= PERFECT_COMPLETION_RATE) {
    return 'perfect';
  }
  if (achievement.completionRate >= ALMOST_COMPLETION_RATE) {
    return 'almost';
  }
  return 'completed';
}

export const AchievementPolicy = {
  getBadgeType,
} as const;
