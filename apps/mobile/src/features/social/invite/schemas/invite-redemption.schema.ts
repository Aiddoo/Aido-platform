import { redeemInviteResponseSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { inviteRewardOrUnknownSchema } from './invite-reward.schema';
import { inviteCodeSchema } from './invite.schema';

/** 초대 코드가 앱에 들어온 경로. 분석 이벤트 invite_link_opened.source와 같은 값이다 */
export const inviteLinkSourceSchema = z.enum([
  'universal_link',
  'app_scheme',
  'kakao',
  'install_referrer',
  'code_entry',
]);

export type InviteLinkSource = z.output<typeof inviteLinkSourceSchema>;

export const pendingRedemptionSchema = z.strictObject({
  inviteCode: inviteCodeSchema,
  source: inviteLinkSourceSchema,
  savedAt: instantSchema,
});

export type PendingRedemption = z.output<typeof pendingRedemptionSchema>;

// rewards가 있는 REDEEMED만 모르는 보상 종류를 UNKNOWN으로 흡수하도록 바꾼다
const [RedeemedSchema, ConnectedSchema, AlreadyFriendsSchema] = redeemInviteResponseSchema.options;

export const redemptionResultSchema = z.discriminatedUnion('outcome', [
  RedeemedSchema.extend({ rewards: z.array(inviteRewardOrUnknownSchema) }),
  ConnectedSchema,
  AlreadyFriendsSchema,
]);

export type RedemptionResult = z.output<typeof redemptionResultSchema>;
