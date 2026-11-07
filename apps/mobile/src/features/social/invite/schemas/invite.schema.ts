import { inviteCodeSchema, inviteMilestoneSchema, myInviteResponseSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { inviteRewardOrUnknownSchema } from './invite-reward.schema';

export { normalizeInviteCode, type InviterRewardMilestone } from '@aido/api';

// 서버와 같은 정규화(공백·하이픈 제거, 대문자) 뒤 6자 검증
export { inviteCodeSchema };

export type InviteCode = z.output<typeof inviteCodeSchema>;

const inviteMilestoneWithRewardsSchema = inviteMilestoneSchema.extend({
  rewards: z.array(inviteRewardOrUnknownSchema),
});

export const inviteSchema = myInviteResponseSchema.extend({
  nextMilestone: inviteMilestoneWithRewardsSchema.nullable(),
  rewardsEarned: z.array(inviteRewardOrUnknownSchema),
  createdAt: instantSchema,
});

export type Invite = z.output<typeof inviteSchema>;
