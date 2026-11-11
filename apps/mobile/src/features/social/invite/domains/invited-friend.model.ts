import {
  INVITE_QUALIFICATION,
  REDEMPTION_REJECTION_REASON,
  REDEMPTION_STATUS,
  REDEMPTION_STATUS_UNKNOWN,
} from '@aido/api/vocabulary';
import { instantSchema, toEpochMs } from '@src/shared/date/instant';
import { cursorPageSchema } from '@src/shared/domains/cursor-page.model';
import { match } from 'ts-pattern';
import { z } from 'zod';

// 모르는 새 상태·사유는 응답을 읽을 때 UNKNOWN·null로 바꿔 둔다
export const invitedFriendSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  userTag: z.string(),
  profileImage: z.string().nullable(),
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

export function orderByJoinedAtDesc(friend: InvitedFriend) {
  return -toEpochMs(friend.joinedAt);
}

// 발자국을 기다리는 친구가 먼저 보이게 한다. orderByJoinedAtDesc와 함께 쓴다
export function orderByWaitingFirst(friend: InvitedFriend) {
  return friend.status === REDEMPTION_STATUS.JOINED ? 0 : 1;
}

export function hasStartedActiveDays(friend: InvitedFriend) {
  return friend.activeDayCount > 0;
}

export function getActiveDaysLeft(friend: InvitedFriend) {
  return calculateActiveDaysLeft(friend.activeDayCount, INVITE_QUALIFICATION.MIN_ACTIVE_DAYS);
}

// 목록 행 칩: 발자국을 찍었는지, 기다리는 중인지, 보상에서 빠졌는지
export function getPawPrintState(friend: InvitedFriend) {
  return match(friend.status)
    .with(REDEMPTION_STATUS.QUALIFIED, REDEMPTION_STATUS.REWARDED, () => 'stamped' as const)
    .with(REDEMPTION_STATUS.JOINED, () => 'waiting' as const)
    .with(REDEMPTION_STATUS.REJECTED, () => 'excluded' as const)
    .with(REDEMPTION_STATUS_UNKNOWN, () => 'unknown' as const)
    .exhaustive();
}

export const InvitedFriendPolicy = {
  hasStartedActiveDays,
  getActiveDaysLeft,
  getPawPrintState,
  orderByJoinedAtDesc,
  orderByWaitingFirst,
} as const;
