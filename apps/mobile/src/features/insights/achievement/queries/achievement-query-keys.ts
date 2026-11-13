import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { WeeklyAchievement, WeeklyAchievementPage } from '../domains/achievement.model';

export const ACHIEVEMENT_QUERY_KEYS = {
  all: ['achievement'] as const,
  weeklyList: ({ year }: { year: number }) =>
    queryOptions<InfiniteData<WeeklyAchievementPage, number | undefined>>({
      queryKey: [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly-list', { year }],
    }).queryKey,
  weeklyDetail: ({ year, week }: { year: number; week: number }) =>
    queryOptions<WeeklyAchievement>({
      queryKey: [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly-detail', { year, week }],
    }).queryKey,
} as const;
