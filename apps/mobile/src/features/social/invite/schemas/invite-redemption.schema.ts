import { redeemInviteResponseSchema } from '@aido/api';
import { z } from 'zod';

import { InviteRewardSchema } from './invite-reward.schema';
import { InviteCodeSchema } from './invite.schema';

/** 초대 코드가 앱에 들어온 경로. 분석 이벤트 invite_link_opened.source와 같은 값이다 */
export const InviteLinkSourceSchema = z.enum([
  'universal_link',
  'app_scheme',
  'kakao',
  'install_referrer',
  'code_entry',
]);

export type InviteLinkSource = z.output<typeof InviteLinkSourceSchema>;

export const PendingRedemptionSchema = z.strictObject({
  inviteCode: InviteCodeSchema,
  source: InviteLinkSourceSchema,
  savedAt: z.coerce.date(),
});

export type PendingRedemption = z.output<typeof PendingRedemptionSchema>;

// rewards가 있는 REDEEMED만 모르는 보상 종류를 UNKNOWN으로 흡수하도록 바꾼다
const [RedeemedSchema, ConnectedSchema, AlreadyFriendsSchema] = redeemInviteResponseSchema.options;

export const RedemptionResultSchema = z.discriminatedUnion('outcome', [
  RedeemedSchema.extend({ rewards: z.array(InviteRewardSchema) }),
  ConnectedSchema,
  AlreadyFriendsSchema,
]);

export type RedemptionResult = z.output<typeof RedemptionResultSchema>;
