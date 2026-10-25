import {
  weeklyAchievementSchema as weeklyAchievementDtoSchema,
  weeklyAchievementSummarySchema,
} from '@aido/api';
import { z } from 'zod';

export const weeklyAchievementSchema = weeklyAchievementDtoSchema.extend({ achievedAt: z.date() });
export type WeeklyAchievement = z.infer<typeof weeklyAchievementSchema>;

export const achievementSummarySchema = weeklyAchievementSummarySchema;
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

export const BadgeType = {
  perfect: 'perfect',
  almost: 'almost',
  completed: 'completed',
} as const;
export const badgeTypeSchema = z.enum(BadgeType);
export type BadgeType = z.infer<typeof badgeTypeSchema>;

const PERFECT_COMPLETION_RATE = 100;
const ALMOST_COMPLETION_RATE = 90;

export function getBadgeType(achievement: Pick<WeeklyAchievement, 'completionRate'>): BadgeType {
  if (achievement.completionRate >= PERFECT_COMPLETION_RATE) {
    return BadgeType.perfect;
  }
  if (achievement.completionRate >= ALMOST_COMPLETION_RATE) {
    return BadgeType.almost;
  }
  return BadgeType.completed;
}

export const AchievementPolicy = {
  badgeType: getBadgeType,
} as const;
