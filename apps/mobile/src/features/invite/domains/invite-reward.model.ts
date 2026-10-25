import {
  INVITEE_REWARDS,
  INVITER_REWARD_MILESTONES,
  inviteRewardSchema,
  REWARD_TYPE,
} from '@aido/api';
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

  /**
   * 초대한 사람이 첫 발자국에서 받는 프리미엄 일수. 내 초대 정보를 받기 전 안내에만 쓰고,
   * 받은 뒤에는 서버가 정한 다음 단계(InvitePolicy.nextPremiumDays)를 쓴다.
   */
  inviterPremiumDays() {
    return this.premiumDays(INVITER_REWARD_MILESTONES[0].rewards);
  },
};
