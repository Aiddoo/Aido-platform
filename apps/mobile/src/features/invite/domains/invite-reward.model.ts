import { INVITEE_REWARDS, inviteRewardSchema, REWARD_TYPE } from '@aido/api';
import { sumBy } from 'es-toolkit';
import { z } from 'zod';

const UnknownInviteRewardSchema = z.object({
  rewardType: z.literal('UNKNOWN'),
  quantity: z.number(),
});

// 구버전 앱이 새 보상 종류를 받아도 깨지지 않게 UNKNOWN으로 흡수한다
export const InviteRewardSchema = z
  .union([inviteRewardSchema, UnknownInviteRewardSchema])
  .catch({ rewardType: 'UNKNOWN', quantity: 0 });

export type InviteReward = z.output<typeof InviteRewardSchema>;

export function isPremiumDaysReward(reward: InviteReward) {
  return reward.rewardType === REWARD_TYPE.PREMIUM_DAYS;
}

function isFriendSlotReward(reward: InviteReward) {
  return reward.rewardType === REWARD_TYPE.FRIEND_SLOT;
}

export function calculateRewardQuantity(
  rewards: readonly InviteReward[],
  isTarget: (reward: InviteReward) => boolean,
) {
  return sumBy(rewards.filter(isTarget), (reward) => reward.quantity);
}

export const InviteRewardPolicy = {
  premiumDays(rewards: readonly InviteReward[]) {
    return calculateRewardQuantity(rewards, isPremiumDaysReward);
  },

  friendSlots(rewards: readonly InviteReward[]) {
    return calculateRewardQuantity(rewards, isFriendSlotReward);
  },

  /** 초대받은 사람이 가입하면 받는 프리미엄 일수(초대 카드 영수증) */
  welcomePremiumDays() {
    return this.premiumDays(INVITEE_REWARDS);
  },
};
