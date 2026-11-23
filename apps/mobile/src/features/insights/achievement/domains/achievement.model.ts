import { WEEKLY_ACHIEVEMENT_BADGES, weeklyAchievementBadge } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { completionRateSchema } from '@src/shared/domains/completion-rate.model';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

export const weeklyAchievementSchema = z.object({
  id: z.int(),
  year: z.int(),
  week: z.int().min(1).max(53),
  dateRange: z.object({ startDate: dateKeySchema, endDate: dateKeySchema }),
  totalTodos: z.int().nonnegative(),
  completedTodos: z.int().nonnegative(),
  completionRate: completionRateSchema,
  achievedAt: instantSchema,
});
export type WeeklyAchievement = z.infer<typeof weeklyAchievementSchema>;

const weeklyAchievementSummarySchema = z.object({
  totalWeeks: z.int().nonnegative(),
  perfectWeeks: z.int().nonnegative(),
  currentStreak: z.int().nonnegative(),
  bestStreak: z.int().nonnegative(),
  averageRate: completionRateSchema,
});

export const weeklyAchievementPageSchema = cursorPageSchema(
  weeklyAchievementSchema,
  z.int(),
).extend({
  summary: weeklyAchievementSummarySchema,
});
export type WeeklyAchievementPage = z.infer<typeof weeklyAchievementPageSchema>;

const badgeTypeSchema = z.enum(WEEKLY_ACHIEVEMENT_BADGES);
export type BadgeType = z.infer<typeof badgeTypeSchema>;

/**
 * 빈틈없는 한 주·아깝다 한 끗·꾸준한 한 걸음. 주간 푸시와 같은 판정이라 반올림 완료율이 아니라 할 일 수로 정한다
 * (199/200은 응답 완료율이 100이어도 아깝다 한 끗이다)
 */
export function getBadgeType(achievement: WeeklyAchievement): BadgeType {
  return weeklyAchievementBadge(achievement.completedTodos, achievement.totalTodos);
}

export const AchievementPolicy = {
  getBadgeType,
} as const;
