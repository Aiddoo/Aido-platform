import { INVITEE_REWARDS, INVITER_REWARD_MILESTONES, REWARD_TYPE } from '@aido/api/vocabulary';
import { sumBy } from 'es-toolkit';

import type { InviteReward } from '../schemas/invite-reward.schema';

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

export function getPremiumDays(rewards: readonly InviteReward[]) {
  return calculateRewardQuantity(rewards, isPremiumDaysReward);
}

export function getFriendSlots(rewards: readonly InviteReward[]) {
  return calculateRewardQuantity(rewards, isFriendSlotReward);
}

/** 초대받은 사람이 가입하면 받는 프리미엄 일수(초대 카드 영수증) */
export function getWelcomePremiumDays() {
  return getPremiumDays(INVITEE_REWARDS);
}

/**
 * 초대한 사람이 첫 발자국에서 받는 프리미엄 일수. 내 초대 정보를 받기 전 안내에만 쓰고,
 * 받은 뒤에는 서버가 정한 다음 단계(InvitePolicy.getNextPremiumDays)를 쓴다.
 */
export function getInviterPremiumDays() {
  return getPremiumDays(INVITER_REWARD_MILESTONES[0].rewards);
}

export const InviteRewardPolicy = {
  getPremiumDays,
  getFriendSlots,
  getWelcomePremiumDays,
  getInviterPremiumDays,
} as const;
