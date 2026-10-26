import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { InviteLinkSourceSchema } from '../domains/invite-redemption.model';
import { InviteCodeSchema } from '../domains/invite.model';

// 형식이 틀린 코드는 화면이 "찾을 수 없어요"로 보여 주도록 null로 받는다
const InviteRouteParamsSchema = z.object({
  inviteCode: InviteCodeSchema.nullable().catch(null),
  source: InviteLinkSourceSchema.catch('app_scheme'),
  // 시스템이 링크를 열어 준 경우에만 있다(+native-intent). 앱 안 이동에는 없다
  openedAt: z.coerce.number().int().positive().nullable().catch(null),
});

export function useInviteRouteParams() {
  return InviteRouteParamsSchema.parse(useLocalSearchParams());
}
