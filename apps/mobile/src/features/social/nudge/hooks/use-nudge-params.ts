import { useLocalSearchParams } from 'expo-router';

import { nudgeParamsSchema } from '../schemas/nudge-params.schema';

/** 콕 상세 route의 nudgeId. 읽기만 하는 값 하나라 값 그대로 돌려준다 */
export function useNudgeParams() {
  return nudgeParamsSchema.parse(useLocalSearchParams()).nudgeId;
}
