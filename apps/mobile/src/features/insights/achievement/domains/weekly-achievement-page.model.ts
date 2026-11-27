import { completionRateSchema } from '@src/shared/domains/completion-rate.model';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { z } from 'zod';

import { weeklyAchievementSchema } from './weekly-achievement.model';

const weeklyAchievementSummarySchema = z.object({
  totalWeeks: z.int().nonnegative(),
  perfectWeeks: z.int().nonnegative(),
  currentStreak: z.int().nonnegative(),
  bestStreak: z.int().nonnegative(),
  averageRate: completionRateSchema,
});

/** 한 해의 주간 기록 한 쪽과 그 해 전체 요약. 요약은 쪽마다 같은 값이 온다 */
export const weeklyAchievementPageSchema = cursorPageSchema(
  weeklyAchievementSchema,
  z.int(),
).extend({
  summary: weeklyAchievementSummarySchema,
});
export type WeeklyAchievementPage = z.infer<typeof weeklyAchievementPageSchema>;
