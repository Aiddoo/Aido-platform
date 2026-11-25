import { toInstant } from '@src/shared/date/instant';

import {
  AchievementPolicy,
  type WeeklyAchievement,
  weeklyAchievementSchema,
} from './achievement.model';

function createWeeklyAchievement(overrides: Partial<WeeklyAchievement> = {}) {
  return weeklyAchievementSchema.parse({
    id: 1,
    year: 2026,
    week: 10,
    dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
    totalTodos: 10,
    completedTodos: 10,
    completionRate: 100,
    achievedAt: toInstant('2026-03-08T14:30:00.000Z'),
    ...overrides,
  });
}

describe('AchievementPolicy', () => {
  describe('getBadgeType', () => {
    it.each([
      { name: '모두 끝낸 주', completedTodos: 10, totalTodos: 10, expected: 'perfect' },
      // 응답 완료율은 반올림해 100이지만 주간 푸시는 아깝다 한 끗이라고 보냈다
      { name: '하나 남은 199/200 주', completedTodos: 199, totalTodos: 200, expected: 'almost' },
    ] as const)(
      '응답 완료율 100인 $name은 $expected 배지다',
      ({ completedTodos, totalTodos, expected }) => {
        // Given
        const achievement = createWeeklyAchievement({
          completedTodos,
          totalTodos,
          completionRate: 100,
        });

        // When
        const badgeType = AchievementPolicy.getBadgeType(achievement);

        // Then
        expect(badgeType).toBe(expected);
      },
    );
  });
});
