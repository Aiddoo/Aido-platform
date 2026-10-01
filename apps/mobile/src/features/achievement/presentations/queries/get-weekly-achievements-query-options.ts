import { useAchievementService } from '@src/bootstrap/providers/di-context';
import type { AchievementService } from '@src/features/achievement/services/achievement.service';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { ACHIEVEMENT_QUERY_KEYS } from '../constants/achievement-query-keys.constant';
import { toWeeklyAchievementViewModel } from '../view-models/weekly-achievement.view-model';

export function getWeeklyAchievementsQueryOptions(
  achievementService: AchievementService,
  { year }: { year: number },
) {
  return infiniteQueryOptions({
    queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList(year),
    queryFn: async ({ pageParam, signal }) => {
      const result = await achievementService.getWeeklyAchievements(
        {
          year,
          cursor: pageParam,
        },
        signal,
      );
      return unwrap(result);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasNext) return undefined;
      return lastPage.nextCursor ?? undefined;
    },
    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map(toWeeklyAchievementViewModel),
      })),
    }),
  });
}

export function useGetWeeklyAchievementsQueryOptions(year: number) {
  return getWeeklyAchievementsQueryOptions(useAchievementService(), { year });
}
