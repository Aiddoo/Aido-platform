import { AchievementPolicy } from './achievement.model';

describe('AchievementPolicy.badgeType', () => {
  it('완료율 100%는 빈틈없는 한 주 배지다', () => {
    // Given
    const achievement = { completionRate: 100 };

    // When
    const badgeType = AchievementPolicy.badgeType(achievement);

    // Then
    expect(badgeType).toBe('perfect');
  });

  it('완료율 90% 이상 100% 미만은 아깝다 한 끗 배지다', () => {
    // Given
    const lowerBound = { completionRate: 90 };
    const upperBound = { completionRate: 99.9 };

    // When
    const lowerBadge = AchievementPolicy.badgeType(lowerBound);
    const upperBadge = AchievementPolicy.badgeType(upperBound);

    // Then
    expect(lowerBadge).toBe('almost');
    expect(upperBadge).toBe('almost');
  });

  it('완료율 90% 미만은 꾸준한 한 걸음 배지다', () => {
    // Given
    const achievement = { completionRate: 89.9 };

    // When
    const badgeType = AchievementPolicy.badgeType(achievement);

    // Then
    expect(badgeType).toBe('completed');
  });
});
