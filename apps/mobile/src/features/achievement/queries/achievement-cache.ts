import type { QueryClient } from '@tanstack/react-query';

import { ACHIEVEMENT_QUERY_KEYS } from '../constants/achievement-query-keys';

export function invalidateWeeklyAchievements(queryClient: QueryClient, { year }: { year: number }) {
  return queryClient.invalidateQueries({ queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyList({ year }) });
}
