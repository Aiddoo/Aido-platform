import { inviteRewardSchema, REWARD_TYPE_UNKNOWN } from '@aido/api';
import { z } from 'zod';

const unknownInviteRewardSchema = z.object({
  rewardType: z.literal(REWARD_TYPE_UNKNOWN),
  quantity: z.number(),
});

// 구버전 앱이 새 보상 종류를 받아도 깨지지 않게 UNKNOWN으로 흡수한다
export const InviteRewardSchema = z
  .union([inviteRewardSchema, unknownInviteRewardSchema])
  .catch({ rewardType: REWARD_TYPE_UNKNOWN, quantity: 0 });

export type InviteReward = z.output<typeof InviteRewardSchema>;
