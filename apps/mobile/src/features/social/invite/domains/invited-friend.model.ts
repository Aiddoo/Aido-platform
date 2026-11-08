import {
  INVITE_QUALIFICATION,
  REDEMPTION_STATUS,
  REDEMPTION_STATUS_UNKNOWN,
} from '@aido/api/vocabulary';
import { toEpochMs } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import type { InvitedFriend } from '../schemas/invited-friend.schema';

function orderByJoinedAtDesc(friend: InvitedFriend) {
  return -toEpochMs(friend.joinedAt);
}

// 발자국을 기다리는 친구가 먼저 보이게 한다. orderByJoinedAtDesc와 함께 쓴다
function orderByWaitingFirst(friend: InvitedFriend) {
  return friend.status === REDEMPTION_STATUS.JOINED ? 0 : 1;
}

function calculateActiveDaysLeft(activeDays: number, requiredDays: number) {
  return Math.max(requiredDays - activeDays, 0);
}

function hasStartedActiveDays(friend: Pick<InvitedFriend, 'activeDayCount'>) {
  return friend.activeDayCount > 0;
}

function getActiveDaysLeft(friend: Pick<InvitedFriend, 'activeDayCount'>) {
  return calculateActiveDaysLeft(friend.activeDayCount, INVITE_QUALIFICATION.MIN_ACTIVE_DAYS);
}

/** 목록 행 칩: 발자국을 찍었는지, 기다리는 중인지, 보상에서 빠졌는지 */
function getPawPrintState(friend: Pick<InvitedFriend, 'status'>) {
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
  calculateActiveDaysLeft,
} as const;
