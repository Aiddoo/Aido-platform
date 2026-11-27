import { z } from 'zod';

import { InviteRewardPolicy, inviteRewardSchema } from './invite-reward.model';

// 앱에 묶은 단계 목록(INVITER_REWARD_MILESTONES)도 이 모양으로 읽어 rewards가 readonly다
export const inviteMilestoneSchema = z.object({
  qualifiedCount: z.int().positive(),
  repeatEvery: z.int().positive().nullable(),
  rewards: z.array(inviteRewardSchema).readonly(),
});
export type InviteMilestone = z.infer<typeof inviteMilestoneSchema>;

export const InviteMilestonePolicy = {
  // 반복하지 않는 단계(3·5·10명 등)만 발자국 판에 생선 칸으로 미리 보여 준다
  isOneTime(milestone: InviteMilestone): boolean {
    return milestone.repeatEvery == null;
  },

  getPremiumDays(milestone: InviteMilestone): number {
    return InviteRewardPolicy.getPremiumDays(milestone.rewards);
  },
};
