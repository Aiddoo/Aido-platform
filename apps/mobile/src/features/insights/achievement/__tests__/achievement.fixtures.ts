import {
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
} from '@aido/api/contracts/weekly-achievement/v1';
import { defineFixture } from '@src/testing/fixture';

/** GET /v1/weekly-achievements/{year}/{week} 응답. 2026년 47주(11월 16~22일)를 모두 끝냈다 */
export const createWeeklyAchievementDto = defineFixture(weeklyAchievementDetailResponseSchema, {
  id: 47,
  year: 2026,
  week: 47,
  weekLabel: '11월 3주차',
  dateRange: { startDate: '2026-11-16', endDate: '2026-11-22' },
  totalTodos: 10,
  completedTodos: 10,
  completionRate: 100,
  achievedAt: '2026-11-22T15:00:00.000Z',
});

/** GET /v1/weekly-achievements 응답 한 쪽. 기본은 마지막 쪽이다 */
export const createWeeklyAchievementListDto = defineFixture(weeklyAchievementListResponseSchema, {
  items: [createWeeklyAchievementDto()],
  pagination: { nextCursor: null, hasNext: false, size: 20 },
  summary: { totalWeeks: 1, perfectWeeks: 1, currentStreak: 1, bestStreak: 1, averageRate: 100 },
});
