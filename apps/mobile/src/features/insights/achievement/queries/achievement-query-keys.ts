import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { AchievementYears } from '../domains/achievement-years.model';
import type { WeeklyAchievementPage } from '../domains/weekly-achievement-page.model';
import type { WeeklyAchievement } from '../domains/weekly-achievement.model';

export const ACHIEVEMENT_QUERY_KEYS = {
  all: ['achievement'] as const,
  weeklyLists: () => [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly-list'] as const,
  weeklyList: ({ year }: { year: number }) =>
    queryOptions<InfiniteData<WeeklyAchievementPage, number | undefined>>({
      queryKey: [...ACHIEVEMENT_QUERY_KEYS.weeklyLists(), { year }],
    }).queryKey,
  weeklyYears: () =>
    queryOptions<AchievementYears>({
      queryKey: [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly-years'],
    }).queryKey,
  weeklyDetail: ({ year, week }: { year: number; week: number }) =>
    queryOptions<WeeklyAchievement>({
      queryKey: [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly-detail', { year, week }],
    }).queryKey,
} as const;
