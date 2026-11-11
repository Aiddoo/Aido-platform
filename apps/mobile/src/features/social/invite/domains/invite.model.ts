import { PREMIUM_CAP_STATE } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { InviteRewardPolicy, inviteRewardSchema } from './invite-reward.model';

const inviteMilestoneSchema = z.object({
  qualifiedCount: z.int().positive(),
  rewards: z.array(inviteRewardSchema),
});

const inviterRewardMilestoneSchema = inviteMilestoneSchema.extend({
  repeatEvery: z.int().positive().nullable(),
});
export type InviterRewardMilestone = z.infer<typeof inviterRewardMilestoneSchema>;

export const inviteSchema = z.object({
  code: z.string(),
  link: z.url(),
  waitingCount: z.int().nonnegative(),
  qualifiedCount: z.int().nonnegative(),
  premiumDaysInWindow: z.int().nonnegative(),
  totalPremiumDays: z.int().nonnegative(),
  premiumCapState: z.enum(PREMIUM_CAP_STATE),
  nextMilestone: inviteMilestoneSchema.nullable(),
  rewardsEarned: z.array(inviteRewardSchema),
  createdAt: instantSchema,
});
export type Invite = z.infer<typeof inviteSchema>;

function calculateRemainingInvites(qualifiedCount: number, targetCount: number) {
  return Math.max(targetCount - qualifiedCount, 0);
}

function calculateInvitedCount(qualifiedCount: number, waitingCount: number) {
  return qualifiedCount + waitingCount;
}

// 반복하지 않는 단계(3·5·10명 등)만 발자국 판에 생선 칸으로 미리 보여 준다. 앱에 묶은 단계 상수도 걸러 반복 주기만 받는다
export function isOneTimeMilestone(milestone: Pick<InviterRewardMilestone, 'repeatEvery'>) {
  return milestone.repeatEvery == null;
}

export function getRemainingToNextMilestone(invite: Invite) {
  return invite.nextMilestone == null
    ? null
    : calculateRemainingInvites(invite.qualifiedCount, invite.nextMilestone.qualifiedCount);
}

// 다음 발자국에서 받는 프리미엄 일수(없으면 0)
export function getNextPremiumDays(invite: Invite) {
  return InviteRewardPolicy.getPremiumDays(invite.nextMilestone?.rewards ?? []);
}

export function getNextFriendSlots(invite: Invite) {
  return InviteRewardPolicy.getFriendSlots(invite.nextMilestone?.rewards ?? []);
}

export function getEarnedPremiumDays(invite: Invite) {
  return InviteRewardPolicy.getPremiumDays(invite.rewardsEarned);
}

export function getEarnedFriendSlots(invite: Invite) {
  return InviteRewardPolicy.getFriendSlots(invite.rewardsEarned);
}

// 시작 체크리스트 완료 기준: 가입까지 마친 초대 친구가 한 명이라도 있다
export function hasInvitedAnyone(invite: Invite) {
  return calculateInvitedCount(invite.qualifiedCount, invite.waitingCount) > 0;
}

// 지난번 축하한 뒤로 사용을 시작한 친구가 늘었다
export function hasNewPawPrints(invite: Invite, celebratedCount: number) {
  return invite.qualifiedCount > celebratedCount;
}

// 진행 안내가 말할 상황(문구는 화면이 고른다). 상한은 서버의 premiumCapState를 따른다
export function getProgress(invite: Invite) {
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
  hasInvitedAnyone,
  hasNewPawPrints,
  getProgress,
} as const;
