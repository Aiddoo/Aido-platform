import type { WeeklyAchievementDto } from '@aido/api';

import { toWeeklyAchievement } from './achievement.mapper';

const dto: WeeklyAchievementDto = {
  id: 42,
  year: 2026,
  week: 10,
  weekLabel: '3월 2주차',
  dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
  totalTodos: 15,
  completedTodos: 14,
  completionRate: 93.3,
  achievedAt: '2026-03-08T14:30:00.000Z',
};

describe('toWeeklyAchievement', () => {
  it('달성 시각을 Date로 바꾸지 않고 같은 순간의 문자열로 둔다', () => {
    // Given
    const first = toWeeklyAchievement(dto);

    // When
    const second = toWeeklyAchievement(dto);

    // Then
    expect(first.achievedAt).toBe('2026-03-08T14:30:00.000Z');
    expect(second.achievedAt).toBe(first.achievedAt);
  });
});
