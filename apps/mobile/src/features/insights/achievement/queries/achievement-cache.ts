import type { QueryClient } from '@tanstack/react-query';

import { ACHIEVEMENT_QUERY_KEYS } from './achievement-query-keys';

export function invalidateWeeklyAchievements(queryClient: QueryClient, { year }: { year: number }) {
  return queryClient.invalidateQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList({ year }) });
}

/** 당겨서 새로고침. 화면에 붙은 그해 주간 목록만 다시 받는다 */
export function refreshWeeklyAchievements(queryClient: QueryClient, { year }: { year: number }) {
  return queryClient.refetchQueries({
    queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList({ year }),
    type: 'active',
  });
}
