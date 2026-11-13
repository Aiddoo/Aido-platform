import {
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
} from '@aido/api';

import { weeklyAchievementPageSchema, weeklyAchievementSchema } from '../domains/achievement.model';
import { toWeeklyAchievement, toWeeklyAchievementPage } from './achievement.mapper';

const dto = weeklyAchievementDetailResponseSchema.parse({
  id: 42,
  year: 2026,
  week: 10,
  weekLabel: '3월 2주차',
  dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
  totalTodos: 15,
  completedTodos: 14,
  completionRate: 93.3,
  achievedAt: '2026-03-08T14:30:00.000Z',
});

describe('toWeeklyAchievement', () => {
  it('계약 응답을 앱의 주간 달성 모델로 바꾼다', () => {
    // When
    const achievement = toWeeklyAchievement(dto);

    // Then
    expect(weeklyAchievementSchema.parse(achievement)).toEqual(achievement);
    expect(achievement).toMatchObject({ id: 42, week: 10, completionRate: 93.3 });
  });

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

describe('toWeeklyAchievementPage', () => {
  it('목록 응답의 페이지 정보와 요약을 앱의 페이지 모델로 바꾼다', () => {
    // Given
    const listDto = weeklyAchievementListResponseSchema.parse({
      items: [dto],
      pagination: { nextCursor: 21, hasNext: true, size: 20 },
      summary: {
        totalWeeks: 8,
        perfectWeeks: 3,
        currentStreak: 4,
        bestStreak: 6,
        averageRate: 87,
      },
    });

    // When
    const page = toWeeklyAchievementPage(listDto);

    // Then
    expect(weeklyAchievementPageSchema.parse(page)).toEqual(page);
    expect(page).toMatchObject({ nextCursor: 21, summary: { perfectWeeks: 3 } });
    expect(page.items).toHaveLength(1);
  });
});
