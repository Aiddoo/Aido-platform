import type { WeeklyAchievementDto, WeeklyAchievementListResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { WeeklyAchievement, WeeklyAchievementPage } from '../domains/achievement.model';

export function toWeeklyAchievement(dto: WeeklyAchievementDto): WeeklyAchievement {
  return {
    ...pick(dto, ['id', 'year', 'week', 'totalTodos', 'completedTodos', 'completionRate']),
    dateRange: pick(dto.dateRange, ['startDate', 'endDate']),
    achievedAt: toInstant(dto.achievedAt),
  };
}

export function toWeeklyAchievementPage(dto: WeeklyAchievementListResponse): WeeklyAchievementPage {
  return {
    items: dto.items.map(toWeeklyAchievement),
    nextCursor: dto.pagination.nextCursor,
    hasNext: dto.pagination.hasNext,
    summary: pick(dto.summary, [
      'totalWeeks',
      'perfectWeeks',
      'currentStreak',
      'bestStreak',
      'averageRate',
    ]),
  };
}
