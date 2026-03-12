import { useAchievementService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { ACHIEVEMENT_QUERY_KEYS } from '../constants/achievement-query-keys.constant';

export const useGetWeeklyAchievementQueryOptions = (year: number, week: number) => {
  const achievementService = useAchievementService();

  return queryOptions({
    queryKey: ACHIEVEMENT_QUERY_KEYS.weeklyDetail(year, week),
    queryFn: async () => {
      const result = await achievementService.getWeeklyAchievement(year, week);
      return unwrap(result);
    },
  });
};
