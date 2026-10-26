import { useAchievementService } from '@src/bootstrap/providers/di-context';
import type { AchievementService } from '@src/features/achievement/apis/achievement.service';
import { unwrap } from '@src/shared/errors/result';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';

import { ACHIEVEMENT_QUERY_KEYS } from '../constants/achievement-query-keys';
import type { WeeklyAchievementsResult } from '../domains/achievement.model';

function selectWeeklyAchievements(
  infinitePages: InfiniteData<WeeklyAchievementsResult, number | undefined>,
) {
  return {
    items: infinitePages.pages.flatMap((page) => page.items),
    summary: infinitePages.pages[0]?.summary,
  };
}

const FIRST_PAGE_CURSOR: number | undefined = undefined;

export function getWeeklyAchievementsInfiniteQueryOptions(
  achievementService: AchievementService,
  { year }: { year: number },
) {
  return infiniteQueryOptions({
    queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList({ year }),
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
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasNext) {
        return undefined;
      }
      return lastPage.nextCursor;
    },
    select: selectWeeklyAchievements,
  });
}

export function useGetWeeklyAchievementsInfiniteQueryOptions({ year }: { year: number }) {
  return getWeeklyAchievementsInfiniteQueryOptions(useAchievementService(), { year });
}
