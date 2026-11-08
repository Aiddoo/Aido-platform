import { inviteCodeSchema, inviteMilestoneSchema, myInviteResponseSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { inviteRewardOrUnknownSchema } from './invite-reward.schema';

export { normalizeInviteCode, type InviterRewardMilestone } from '@aido/api';

// 서버와 같은 정규화(공백·하이픈 제거, 대문자) 뒤 6자 검증
export { inviteCodeSchema };

export type InviteCode = z.output<typeof inviteCodeSchema>;

/** 한글 키보드의 전각 영숫자·하이픈(ＫＡ－７)을 반각으로 바꾼 뒤 서버와 같이 검증한다. 코드가 아니면 null */
export function parseInviteCode(raw: unknown): InviteCode | null {
  const parsed = inviteCodeSchema.safeParse(typeof raw === 'string' ? raw.normalize('NFKC') : raw);
  return parsed.success ? parsed.data : null;
}

const inviteMilestoneWithRewardsSchema = inviteMilestoneSchema.extend({
  rewards: z.array(inviteRewardOrUnknownSchema),
});

export const inviteSchema = myInviteResponseSchema.extend({
  nextMilestone: inviteMilestoneWithRewardsSchema.nullable(),
  rewardsEarned: z.array(inviteRewardOrUnknownSchema),
  createdAt: instantSchema,
});

export type Invite = z.output<typeof inviteSchema>;
