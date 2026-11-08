import { INVITER_REWARD_MILESTONES, PREMIUM_CAP_STATE } from '@aido/api/vocabulary';
import { match } from 'ts-pattern';

import type { Invite, InviterRewardMilestone } from '../schemas/invite.schema';
import { InviteRewardPolicy } from './invite-reward.model';

function calculateRemainingInvites(qualifiedCount: number, targetCount: number) {
  return Math.max(targetCount - qualifiedCount, 0);
}

// 반복하지 않는 단계(3·5·10명 등)만 발자국 판에 생선 칸으로 미리 보여 준다
function findOneTimeMilestoneCounts(milestones: readonly InviterRewardMilestone[]) {
  return milestones
    .filter((milestone) => milestone.repeatEvery == null)
    .map((milestone) => milestone.qualifiedCount);
}

function calculateInvitedCount(qualifiedCount: number, waitingCount: number) {
  return qualifiedCount + waitingCount;
}

function getRemainingToNextMilestone(invite: Pick<Invite, 'qualifiedCount' | 'nextMilestone'>) {
  return invite.nextMilestone == null
    ? null
    : calculateRemainingInvites(invite.qualifiedCount, invite.nextMilestone.qualifiedCount);
}

/** 다음 발자국에서 받는 프리미엄 일수(없으면 0) */
function getNextPremiumDays(invite: Pick<Invite, 'nextMilestone'>) {
  return InviteRewardPolicy.getPremiumDays(invite.nextMilestone?.rewards ?? []);
}

function getNextFriendSlots(invite: Pick<Invite, 'nextMilestone'>) {
  return InviteRewardPolicy.getFriendSlots(invite.nextMilestone?.rewards ?? []);
}

function getEarnedPremiumDays(invite: Pick<Invite, 'rewardsEarned'>) {
  return InviteRewardPolicy.getPremiumDays(invite.rewardsEarned);
}

function getEarnedFriendSlots(invite: Pick<Invite, 'rewardsEarned'>) {
  return InviteRewardPolicy.getFriendSlots(invite.rewardsEarned);
}

function getMilestoneQualifiedCounts() {
  return findOneTimeMilestoneCounts(INVITER_REWARD_MILESTONES);
}

/** 가입까지 마친 초대 친구가 한 명이라도 있는지(시작 체크리스트 완료 기준) */
function hasInvitedAnyone(invite: Pick<Invite, 'qualifiedCount' | 'waitingCount'>) {
  return calculateInvitedCount(invite.qualifiedCount, invite.waitingCount) > 0;
}

/**
 * 발자국 판 아래 진행 안내가 어떤 상황을 말할지 정한다(문구는 화면이 고른다).
 * 프리미엄 상한은 서버가 정한 premiumCapState를 그대로 따른다
 */
function getProgress(invite: Pick<Invite, 'premiumCapState' | 'qualifiedCount'>) {
  return match({
    premiumCapState: invite.premiumCapState,
    hasPawPrint: invite.qualifiedCount > 0,
  })
    .with({ premiumCapState: PREMIUM_CAP_STATE.TOTAL_REACHED }, () => 'total-cap-reached' as const)
    .with(
      { premiumCapState: PREMIUM_CAP_STATE.WINDOW_REACHED },
      () => 'monthly-cap-reached' as const,
    )
    .with({ hasPawPrint: false }, () => 'not-started' as const)
    .with({ hasPawPrint: true }, () => 'in-progress' as const)
    .exhaustive();
}

export const InvitePolicy = {
  getRemainingToNextMilestone,
  getNextPremiumDays,
  getNextFriendSlots,
  getEarnedPremiumDays,
  getEarnedFriendSlots,
  getMilestoneQualifiedCounts,
  hasInvitedAnyone,
  getProgress,
  calculateRemainingInvites,
  findOneTimeMilestoneCounts,
} as const;
