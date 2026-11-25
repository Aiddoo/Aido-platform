import {
  INVITE_QUALIFICATION,
  REDEMPTION_REJECTION_REASON,
  REDEMPTION_STATUS,
  REDEMPTION_STATUS_UNKNOWN,
} from '@aido/api/vocabulary';
import { instantSchema, toEpochMs } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { match } from 'ts-pattern';
import { z } from 'zod';

// 모르는 새 상태·사유는 응답을 읽을 때 UNKNOWN·null로 바꿔 둔다
export const invitedFriendSchema = userSummarySchema.omit({ id: true }).extend({
  userId: z.string(),
  status: z.union([z.enum(REDEMPTION_STATUS), z.literal(REDEMPTION_STATUS_UNKNOWN)]),
  activeDayCount: z.int().nonnegative(),
  joinedAt: instantSchema,
  qualifiedAt: instantSchema.nullable(),
  rejectionReason: z.enum(REDEMPTION_REJECTION_REASON).nullable(),
});
export type InvitedFriend = z.infer<typeof invitedFriendSchema>;

const invitedFriendPageSchema = cursorPageSchema(invitedFriendSchema, z.string()).extend({
  totalCount: z.number(),
});
export type InvitedFriendPage = z.infer<typeof invitedFriendPageSchema>;

function calculateActiveDaysLeft(activeDays: number, requiredDays: number) {
  return Math.max(requiredDays - activeDays, 0);
}

export const InvitedFriendPolicy = {
  orderByJoinedAtDesc(friend: InvitedFriend): number {
    return -toEpochMs(friend.joinedAt);
  },

  // 발자국을 기다리는 친구가 먼저 보이게 한다. orderByJoinedAtDesc와 함께 쓴다
  orderByWaitingFirst(friend: InvitedFriend): 1 | 0 {
    return friend.status === REDEMPTION_STATUS.JOINED ? 0 : 1;
  },

  hasStartedActiveDays(friend: InvitedFriend): boolean {
    return friend.activeDayCount > 0;
  },

  getActiveDaysLeft(friend: InvitedFriend): number {
    return calculateActiveDaysLeft(friend.activeDayCount, INVITE_QUALIFICATION.MIN_ACTIVE_DAYS);
  },

  // 목록 행 칩: 발자국을 찍었는지, 기다리는 중인지, 보상에서 빠졌는지
  getPawPrintState(friend: InvitedFriend): 'unknown' | 'stamped' | 'waiting' | 'excluded' {
    return match(friend.status)
      .with(REDEMPTION_STATUS.QUALIFIED, REDEMPTION_STATUS.REWARDED, () => 'stamped' as const)
      .with(REDEMPTION_STATUS.JOINED, () => 'waiting' as const)
      .with(REDEMPTION_STATUS.REJECTED, () => 'excluded' as const)
      .with(REDEMPTION_STATUS_UNKNOWN, () => 'unknown' as const)
      .exhaustive();
  },
};
