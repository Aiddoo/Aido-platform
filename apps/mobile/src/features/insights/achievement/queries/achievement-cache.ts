import type { QueryClient } from '@tanstack/react-query';

import { ACHIEVEMENT_QUERY_KEYS } from './achievement-query-keys';

export function invalidateWeeklyAchievements(queryClient: QueryClient, { year }: { year: number }) {
  return queryClient.invalidateQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList({ year }) });
}

/** 새해 첫 기록이 생기면 기록 있는 연도가 늘어 배지 화면이 새해로 넘어간다 */
export function refreshWeeklyAchievements(queryClient: QueryClient) {
  return Promise.all([
    queryClient.refetchQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyLists(), type: 'active' }),
    queryClient.refetchQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyYears(), type: 'active' }),
  ]);
}
