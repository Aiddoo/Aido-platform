import { useLocalSearchParams } from 'expo-router';

import { inviteWelcomeParamsSchema } from '../schemas/invite-params.schema';

/** 환영 시트 route param. 라우트와 시트가 이 훅 하나로만 읽는다 */
export function useInviteWelcomeParams() {
  return inviteWelcomeParamsSchema.parse(useLocalSearchParams());
}
