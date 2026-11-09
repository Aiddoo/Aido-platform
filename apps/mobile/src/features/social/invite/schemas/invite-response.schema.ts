import {
  inviteMilestoneSchema,
  inviteRewardSchema,
  myInviteResponseSchema,
  redeemInviteResponseSchema,
} from '@aido/api';
import { REWARD_TYPE_UNKNOWN } from '@aido/api/vocabulary';
import { z } from 'zod';

const unknownInviteRewardSchema = z.object({
  rewardType: z.literal(REWARD_TYPE_UNKNOWN),
  quantity: z.number(),
});

// 구버전 앱이 새 보상 종류를 받아도 깨지지 않게 UNKNOWN으로 흡수한다
export const inviteRewardResponseSchema = z
  .union([inviteRewardSchema, unknownInviteRewardSchema])
  .catch({ rewardType: REWARD_TYPE_UNKNOWN, quantity: 0 });
export type InviteRewardResponse = z.output<typeof inviteRewardResponseSchema>;

export const inviteResponseSchema = myInviteResponseSchema.extend({
  nextMilestone: inviteMilestoneSchema
    .extend({ rewards: z.array(inviteRewardResponseSchema) })
    .nullable(),
  rewardsEarned: z.array(inviteRewardResponseSchema),
});
export type InviteResponse = z.output<typeof inviteResponseSchema>;

const [redeemedResponseSchema, connectedResponseSchema, alreadyFriendsResponseSchema] =
  redeemInviteResponseSchema.options;

export const redeemResponseSchema = z.discriminatedUnion('outcome', [
  redeemedResponseSchema.extend({ rewards: z.array(inviteRewardResponseSchema) }),
  connectedResponseSchema,
  alreadyFriendsResponseSchema,
]);
export type RedeemResponse = z.output<typeof redeemResponseSchema>;
