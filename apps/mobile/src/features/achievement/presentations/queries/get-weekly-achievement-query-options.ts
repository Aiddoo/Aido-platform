import { useAchievementService } from '@src/bootstrap/providers/di-context';
import type { AchievementService } from '@src/features/achievement/services/achievement.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { ACHIEVEMENT_QUERY_KEYS } from '../constants/achievement-query-keys.constant';

export function getWeeklyAchievementQueryOptions(
  achievementService: AchievementService,
  { year, week }: { year: number; week: number },
) {
  return queryOptions({
    queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyDetail(year, week),
    queryFn: async ({ signal }) => {
      const result = await achievementService.getWeeklyAchievement(year, week, signal);
      return unwrap(result);
    },
  });
}

export function useGetWeeklyAchievementQueryOptions(year: number, week: number) {
  return getWeeklyAchievementQueryOptions(useAchievementService(), { year, week });
}
