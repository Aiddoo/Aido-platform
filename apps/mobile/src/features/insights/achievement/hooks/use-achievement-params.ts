import { useLocalSearchParams } from 'expo-router';

import { achievementParamsSchema } from '../schemas/achievement-params.schema';

/** 주간 성취 상세의 경로 세그먼트(연도·주차). 화면의 정체성이라 바꾸지 않는다 */
export function useAchievementParams() {
  return achievementParamsSchema.parse(useLocalSearchParams());
}
