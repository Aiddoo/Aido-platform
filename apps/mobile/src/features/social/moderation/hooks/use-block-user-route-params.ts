import { useLocalSearchParams } from 'expo-router';

import { blockUserRouteParamsSchema } from '../schemas/moderation-params.schema';

/** 차단 확인 route의 대상. 이름은 확인 문구에만 쓰는 보기 값이다 */
export function useBlockUserRouteParams() {
  return blockUserRouteParamsSchema.parse(useLocalSearchParams());
}
