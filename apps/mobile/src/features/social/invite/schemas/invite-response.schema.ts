import {
  inviteMilestoneSchema,
  invitedFriendResponseSchema,
  invitedFriendsListResponseSchema,
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

// 앞으로 서버가 더할 보상 종류를 받아도 깨지지 않게 UNKNOWN으로 흡수한다
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
  redeemedResponseSchema.extend({
    rewards: z.array(inviteRewardResponseSchema),
    // 지금 서버는 다시 수락한 응답인지 항상 싣는다
    isReplay: z.boolean(),
  }),
  connectedResponseSchema,
  alreadyFriendsResponseSchema,
]);
export type RedeemResponse = z.output<typeof redeemResponseSchema>;

/** 지금 서버는 보상 제외 사유 칸을 항상 싣는다(REJECTED가 아니면 null) */
export const invitedFriendsResponseSchema = invitedFriendsListResponseSchema.extend({
  items: z.array(invitedFriendResponseSchema.required({ rejectionReason: true })),
});
export type InvitedFriendsResponse = z.output<typeof invitedFriendsResponseSchema>;
export type InvitedFriendResponse = InvitedFriendsResponse['items'][number];
