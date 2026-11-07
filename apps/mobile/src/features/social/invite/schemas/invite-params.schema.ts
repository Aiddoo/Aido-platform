import { userIdParamSchema } from '@aido/api';
import { z } from 'zod';

import { InviteLinkSourceSchema } from '../schemas/invite-redemption.schema';
import { InviteCodeSchema } from '../schemas/invite.schema';

// 형식이 틀린 코드는 화면이 "찾을 수 없어요"로 보여 주도록 null로 받는다
export const inviteParamsSchema = z.object({
  inviteCode: InviteCodeSchema.nullable().catch(null),
  source: InviteLinkSourceSchema.catch('app_scheme'),
  // 시스템이 링크를 열어 준 경우에만 있다(+native-intent). 앱 안 이동에는 없다
  openedAt: z.coerce.number().int().positive().nullable().catch(null),
});

// 형식이 틀린 친구 ID면 보여 줄 수락 결과가 없어 시트가 바로 닫히도록 null로 받는다
export const inviteWelcomeParamsSchema = z.object({
  friendId: userIdParamSchema.shape.userId.nullable().catch(null),
});

export const invitedFriendsViewSchema = z.enum(['all', 'waiting']);

export type InvitedFriendsView = z.output<typeof invitedFriendsViewSchema>;

export const invitedFriendsParamsSchema = z.object({
  view: invitedFriendsViewSchema.catch('all'),
});
