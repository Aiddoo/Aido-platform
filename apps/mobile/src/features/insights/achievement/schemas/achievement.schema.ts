import {
  getWeeklyAchievementsQuerySchema,
  weeklyAchievementListResponseSchema,
  weeklyAchievementSchema as weeklyAchievementContractSchema,
  weeklyAchievementSummarySchema,
} from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 서버 계약에서 앱이 쓰는 칸은 그대로 두고, 시각은 Date로 바꾸지 않고 Instant 그대로 둔다 */
const weeklyAchievementSchema = weeklyAchievementContractSchema.extend({
  achievedAt: instantSchema,
});
export type WeeklyAchievement = z.infer<typeof weeklyAchievementSchema>;

const weeklyAchievementsResultSchema = weeklyAchievementListResponseSchema.shape.pagination
  .pick({ nextCursor: true, hasNext: true })
  .extend({
    items: z.array(weeklyAchievementSchema),
    summary: weeklyAchievementSummarySchema,
  });
export type WeeklyAchievementsResult = z.infer<typeof weeklyAchievementsResultSchema>;

/** 계약은 문자열 query를 숫자로 바꿔 입력 타입이 unknown이다. 앱은 바꾼 뒤의 값을 보내고 기본값이 있는 칸은 생략한다 */
const getAchievementsQuerySchema = getWeeklyAchievementsQuerySchema.partial({ size: true });
export type GetAchievementsQuery = z.output<typeof getAchievementsQuerySchema>;

export const BADGE_TYPE = {
  perfect: 'perfect',
  almost: 'almost',
  completed: 'completed',
} as const;
export type BadgeType = (typeof BADGE_TYPE)[keyof typeof BADGE_TYPE];
