import { router, useLocalSearchParams } from 'expo-router';

import { achievementParamsSchema } from '../schemas/achievement-params.schema';

/** 주간 성취 상세의 연도·주차를 `[values, setValues]`로 읽고 바꾼다 */
export function useAchievementParams() {
  const values = achievementParamsSchema.parse(useLocalSearchParams());

  return [
    values,
    (next: Partial<typeof values>) =>
      router.setParams({
        ...(next.year != null && { year: String(next.year) }),
        ...(next.week != null && { week: String(next.week) }),
      }),
  ] as const;
}
