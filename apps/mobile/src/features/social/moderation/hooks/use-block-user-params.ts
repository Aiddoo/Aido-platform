import { useLocalSearchParams } from 'expo-router';

import { blockUserParamsSchema } from '../schemas/moderation-params.schema';

/** 차단 확인 route의 대상. 이름은 확인 문구에만 쓰는 보기 값이다 */
export function useBlockUserParams() {
  return blockUserParamsSchema.parse(useLocalSearchParams());
}
