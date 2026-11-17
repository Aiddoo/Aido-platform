import type {
  WeeklyAchievementDto,
  WeeklyAchievementListResponse,
  WeeklyAchievementYearsResponse,
} from '@aido/api/contracts/weekly-achievement/v1';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { AchievementYears } from '../domains/achievement-years.model';
import type { WeeklyAchievement, WeeklyAchievementPage } from '../domains/achievement.model';

export function toWeeklyAchievement(dto: WeeklyAchievementDto): WeeklyAchievement {
  return {
    ...pick(dto, ['id', 'year', 'week', 'totalTodos', 'completedTodos', 'completionRate']),
    dateRange: {
      startDate: dateKeySchema.parse(dto.dateRange.startDate),
      endDate: dateKeySchema.parse(dto.dateRange.endDate),
    },
    achievedAt: toInstant(dto.achievedAt),
  };
}

export function toWeeklyAchievementPage(dto: WeeklyAchievementListResponse): WeeklyAchievementPage {
  return {
    items: dto.items.map(toWeeklyAchievement),
    nextCursor: dto.pagination.hasNext ? dto.pagination.nextCursor : null,
    summary: pick(dto.summary, [
      'totalWeeks',
      'perfectWeeks',
      'currentStreak',
      'bestStreak',
      'averageRate',
    ]),
  };
}

export function toAchievementYears(dto: WeeklyAchievementYearsResponse): AchievementYears {
  return { years: dto.years };
}
