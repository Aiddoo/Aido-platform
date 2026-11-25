import { PREMIUM_CAP_STATE } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';
import { z } from 'zod';

import {
  type InviteMilestone,
  InviteMilestonePolicy,
  inviteMilestoneSchema,
} from './invite-milestone.model';
import { InviteRewardPolicy, inviteRewardSchema } from './invite-reward.model';

export const inviteSchema = z.object({
  code: z.string(),
  link: z.url(),
  waitingCount: z.int().nonnegative(),
  qualifiedCount: z.int().nonnegative(),
  premiumDaysInWindow: z.int().nonnegative(),
  totalPremiumDays: z.int().nonnegative(),
  premiumCapState: z.enum(PREMIUM_CAP_STATE),
  // 서버는 다음 단계의 반복 주기를 싣지 않는다
  nextMilestone: inviteMilestoneSchema.omit({ repeatEvery: true }).nullable(),
  rewardsEarned: z.array(inviteRewardSchema),
  createdAt: instantSchema,
});
export type Invite = z.infer<typeof inviteSchema>;

export type PawPrintState = 'stamped' | 'waiting' | 'empty' | 'milestone';

function calculateRemainingInvites(qualifiedCount: number, targetCount: number) {
  return Math.max(targetCount - qualifiedCount, 0);
}

function calculateInvitedCount(qualifiedCount: number, waitingCount: number) {
  return qualifiedCount + waitingCount;
}

export const InvitePolicy = {
  findRemainingToNextMilestone(invite: Invite): number | null {
    return invite.nextMilestone == null
      ? null
      : calculateRemainingInvites(invite.qualifiedCount, invite.nextMilestone.qualifiedCount);
  },

  // 다음 발자국에서 받는 프리미엄 일수(없으면 0)
  getNextPremiumDays(invite: Invite): number {
    return invite.nextMilestone == null
      ? 0
      : InviteRewardPolicy.getPremiumDays(invite.nextMilestone.rewards);
  },

  getNextFriendSlots(invite: Invite): number {
    return invite.nextMilestone == null
      ? 0
      : InviteRewardPolicy.getFriendSlots(invite.nextMilestone.rewards);
  },

  getEarnedPremiumDays(invite: Invite): number {
    return InviteRewardPolicy.getPremiumDays(invite.rewardsEarned);
  },

  getEarnedFriendSlots(invite: Invite): number {
    return InviteRewardPolicy.getFriendSlots(invite.rewardsEarned);
  },

  // 시작 체크리스트 완료 기준: 가입까지 마친 초대 친구가 한 명이라도 있다
  hasInvitedAnyone(invite: Invite): boolean {
    return calculateInvitedCount(invite.qualifiedCount, invite.waitingCount) > 0;
  },

  // 지난번 축하한 뒤로 사용을 시작한 친구가 늘었다
  hasNewPawPrints(invite: Invite, celebratedCount: number): boolean {
    return invite.qualifiedCount > celebratedCount;
  },

  /** 지금 보여 줄 발자국 판(0부터). 막 채우고 아직 축하하지 않았으면 그 판을 한 번 더 보여 주고 다음에 새 판으로 넘어간다 */
  getPawPrintBoardIndex(invite: Invite, celebratedCount: number, boardSize: number): number {
    const pawPrintedCount = invite.qualifiedCount;
    const isJustFilled =
      pawPrintedCount > 0 && pawPrintedCount % boardSize === 0 && celebratedCount < pawPrintedCount;
    return isJustFilled ? pawPrintedCount / boardSize - 1 : Math.floor(pawPrintedCount / boardSize);
  },

  /** 첫 판부터 0으로 센 칸의 상태. 찍힌 발자국 뒤로 기다리는 친구가 잇고, 빈 칸 중 한 번만 주는 단계는 생선 칸이다 */
  getPawPrintState(
    invite: Invite,
    index: number,
    milestones: readonly InviteMilestone[],
  ): PawPrintState {
    if (index < invite.qualifiedCount) {
      return 'stamped';
    }
    if (index < invite.qualifiedCount + invite.waitingCount) {
      return 'waiting';
    }

    return milestones.some(
      (milestone) =>
        InviteMilestonePolicy.isOneTime(milestone) && milestone.qualifiedCount === index + 1,
    )
      ? 'milestone'
      : 'empty';
  },

  // 진행 안내가 말할 상황(문구는 화면이 고른다). 상한은 서버의 premiumCapState를 따른다
  getProgress(
    invite: Invite,
  ): 'total-cap-reached' | 'monthly-cap-reached' | 'not-started' | 'in-progress' {
    return match({
      premiumCapState: invite.premiumCapState,
      hasPawPrint: invite.qualifiedCount > 0,
    })
      .with(
        { premiumCapState: PREMIUM_CAP_STATE.TOTAL_REACHED },
        () => 'total-cap-reached' as const,
      )
      .with(
        { premiumCapState: PREMIUM_CAP_STATE.WINDOW_REACHED },
        () => 'monthly-cap-reached' as const,
      )
      .with({ hasPawPrint: false }, () => 'not-started' as const)
      .with({ hasPawPrint: true }, () => 'in-progress' as const)
      .exhaustive();
  },
};
