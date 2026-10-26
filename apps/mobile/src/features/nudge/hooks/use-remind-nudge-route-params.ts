import { userIdParamSchema } from '@aido/api';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

export const remindNudgeRouteParamsSchema = userIdParamSchema.extend({
  name: z.string().trim().min(1),
});

/** 친구 독촉 콕 route의 받는 사람. 이름은 시트 문구에만 쓰는 보기 값이다 */
export function useRemindNudgeRouteParams() {
  return remindNudgeRouteParamsSchema.parse(useLocalSearchParams());
}
