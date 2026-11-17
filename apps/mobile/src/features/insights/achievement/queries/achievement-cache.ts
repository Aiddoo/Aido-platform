import type { QueryClient } from '@tanstack/react-query';

import { ACHIEVEMENT_QUERY_KEYS } from './achievement-query-keys';

export function invalidateWeeklyAchievements(queryClient: QueryClient, { year }: { year: number }) {
  return queryClient.invalidateQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList({ year }) });
}

/**
 * 당겨서 새로고침. 화면에 붙은 주간 목록과 기록 있는 연도만 다시 받는다(리포트 추세는 1월 초에 두 해를 붙인다).
 * 새해 첫 기록이 생기면 연도가 늘어 배지 화면이 새해로 넘어간다
 */
export function refreshWeeklyAchievements(queryClient: QueryClient) {
  return Promise.all([
    queryClient.refetchQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyLists(), type: 'active' }),
    queryClient.refetchQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyYears(), type: 'active' }),
  ]);
}
