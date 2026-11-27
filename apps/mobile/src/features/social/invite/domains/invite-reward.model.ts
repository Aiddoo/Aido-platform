import { REWARD_TYPE, REWARD_TYPE_UNKNOWN, type RewardType } from '@aido/api/vocabulary';
import { sumBy } from 'es-toolkit';
import { z } from 'zod';

// 모르는 새 보상 종류는 응답을 읽을 때 UNKNOWN으로 바꿔 둔다
export const inviteRewardSchema = z.object({
  rewardType: z.union([z.enum(REWARD_TYPE), z.literal(REWARD_TYPE_UNKNOWN)]),
  quantity: z.int().nonnegative(),
});
export type InviteReward = z.infer<typeof inviteRewardSchema>;

function sumQuantity(rewards: readonly InviteReward[], rewardType: RewardType) {
  return sumBy(
    rewards.filter((reward) => reward.rewardType === rewardType),
    (reward) => reward.quantity,
  );
}

// 초대·단계·수락 결과가 실은 보상 목록을 같은 규칙으로 더한다
export const InviteRewardPolicy = {
  getPremiumDays(rewards: readonly InviteReward[]): number {
    return sumQuantity(rewards, REWARD_TYPE.PREMIUM_DAYS);
  },

  getFriendSlots(rewards: readonly InviteReward[]): number {
    return sumQuantity(rewards, REWARD_TYPE.FRIEND_SLOT);
  },
};
