import {
  INVITE_QUALIFICATION,
  REDEMPTION_STATUS,
  REDEMPTION_STATUS_UNKNOWN,
} from '@aido/api/vocabulary';
import { toEpochMs } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import type { InvitedFriend } from '../schemas/invited-friend.schema';

export function orderByJoinedAtDesc(friend: InvitedFriend) {
  return -toEpochMs(friend.joinedAt);
}

// 발자국을 기다리는 친구가 먼저 보이게 한다. orderByJoinedAtDesc와 함께 쓴다
export function orderByWaitingFirst(friend: InvitedFriend) {
  return friend.status === REDEMPTION_STATUS.JOINED ? 0 : 1;
}

export function calculateActiveDaysLeft(activeDays: number, requiredDays: number) {
  return Math.max(requiredDays - activeDays, 0);
}

/** 발자국이 찍히려면 할 일을 해내야 하는 서로 다른 날 수 */
export function getRequiredActiveDays() {
  return INVITE_QUALIFICATION.MIN_ACTIVE_DAYS;
}

/** 가입한 뒤 발자국을 남길 수 있는 기간(일) */
export function getQualificationWindowDays() {
  return INVITE_QUALIFICATION.EXPIRE_AFTER_DAYS;
}

export function getActiveDaysLeft(friend: Pick<InvitedFriend, 'activeDayCount'>) {
  return calculateActiveDaysLeft(friend.activeDayCount, getRequiredActiveDays());
}

/** 목록 행 칩: 발자국을 찍었는지, 기다리는 중인지, 보상에서 빠졌는지 */
export function getPawPrintState(friend: Pick<InvitedFriend, 'status'>) {
  return match(friend.status)
    .with(REDEMPTION_STATUS.QUALIFIED, REDEMPTION_STATUS.REWARDED, () => 'stamped' as const)
    .with(REDEMPTION_STATUS.JOINED, () => 'waiting' as const)
    .with(REDEMPTION_STATUS.REJECTED, () => 'excluded' as const)
    .with(REDEMPTION_STATUS_UNKNOWN, () => 'unknown' as const)
    .exhaustive();
}

export const InvitedFriendPolicy = {
  getRequiredActiveDays,
  getQualificationWindowDays,
  getActiveDaysLeft,
  getPawPrintState,
} as const;
