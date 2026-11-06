import { useLocalSearchParams } from 'expo-router';

import { remindNudgeRouteParamsSchema } from '../schemas/nudge-params.schema';

/** 친구 독촉 콕 route의 받는 사람. 이름은 시트 문구에만 쓰는 보기 값이다 */
export function useRemindNudgeRouteParams() {
  return remindNudgeRouteParamsSchema.parse(useLocalSearchParams());
}
