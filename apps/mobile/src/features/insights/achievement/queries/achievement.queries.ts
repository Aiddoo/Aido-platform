import { useAchievementApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { getNextCursor, selectPageItems } from '@src/shared/domains/cursor-page.model';
import { type InfiniteData, infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import type { WeeklyAchievementPage } from '../domains/achievement.model';
import { ACHIEVEMENT_QUERY_KEYS } from './achievement-query-keys';

const FIRST_PAGE_CURSOR: number | undefined = undefined;

function selectWeeklyAchievements(
  infinitePages: InfiniteData<WeeklyAchievementPage, number | undefined>,
) {
  return {
    items: selectPageItems(infinitePages),
    summary: infinitePages.pages[0]?.summary,
  };
}

export function useGetWeeklyAchievementQueryOptions({
  year,
  week,
}: {
  year: number;
  week: number;
}) {
  const achievementApi = useAchievementApi();

  return queryOptions({
    queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyDetail({ year, week }),
    queryFn: async ({ signal }) =>
      unwrap(await achievementApi.getWeeklyAchievement(year, week, signal)),
  });
}

export function useGetWeeklyAchievementsInfiniteQueryOptions({ year }: { year: number }) {
  const achievementApi = useAchievementApi();

  return infiniteQueryOptions({
    queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList({ year }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await achievementApi.getWeeklyAchievements({ year, cursor: pageParam }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: getNextCursor,
    select: selectWeeklyAchievements,
  });
}
