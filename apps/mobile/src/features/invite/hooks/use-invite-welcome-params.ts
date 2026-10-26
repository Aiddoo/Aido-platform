import { userIdParamSchema } from '@aido/api';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

// 형식이 틀린 친구 ID면 보여 줄 수락 결과가 없어 시트가 바로 닫히도록 null로 받는다
const InviteWelcomeParamsSchema = z.object({
  friendId: userIdParamSchema.shape.userId.nullable().catch(null),
});

/** 환영 시트 route param. 라우트와 시트가 이 훅 하나로만 읽는다 */
export function useInviteWelcomeParams() {
  return InviteWelcomeParamsSchema.parse(useLocalSearchParams());
}
