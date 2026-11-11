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

describe('getBadgeType', () => {
  it('완료율 100%는 빈틈없는 한 주 배지다', () => {
    // Given
    const achievement = createWeeklyAchievement({ completionRate: 100 });

    // When
    const badgeType = AchievementPolicy.getBadgeType(achievement);

    // Then
    expect(badgeType).toBe('perfect');
  });

  it('완료율 90% 이상 100% 미만은 아깝다 한 끗 배지다', () => {
    // Given
    const lowerBound = createWeeklyAchievement({ completionRate: 90 });
    const upperBound = createWeeklyAchievement({ completionRate: 99.9 });

    // When
    const lowerBadge = AchievementPolicy.getBadgeType(lowerBound);
    const upperBadge = AchievementPolicy.getBadgeType(upperBound);

    // Then
    expect(lowerBadge).toBe('almost');
    expect(upperBadge).toBe('almost');
  });

  it('완료율 90% 미만은 꾸준한 한 걸음 배지다', () => {
    // Given
    const achievement = createWeeklyAchievement({ completionRate: 89.9 });

    // When
    const badgeType = AchievementPolicy.getBadgeType(achievement);

    // Then
    expect(badgeType).toBe('completed');
  });
});
