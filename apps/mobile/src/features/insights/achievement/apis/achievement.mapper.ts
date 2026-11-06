import type { WeeklyAchievementDto, WeeklyAchievementListResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import type { WeeklyAchievement, WeeklyAchievementsResult } from '../schemas/achievement.schema';

export function toWeeklyAchievement(dto: WeeklyAchievementDto): WeeklyAchievement {
  return { ...dto, achievedAt: toInstant(dto.achievedAt) };
}

export function toWeeklyAchievementsResult(
  dto: WeeklyAchievementListResponse,
): WeeklyAchievementsResult {
  return {
    items: dto.items.map(toWeeklyAchievement),
    nextCursor: dto.pagination.nextCursor,
    hasNext: dto.pagination.hasNext,
    summary: dto.summary,
  };
}
