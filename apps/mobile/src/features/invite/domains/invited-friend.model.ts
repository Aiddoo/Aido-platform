import { INVITE_QUALIFICATION, invitedFriendResponseSchema } from '@aido/api';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { toDisplayName } from './invite-preview.model';

// 모르는 새 상태·사유는 @aido/api 스키마가 UNKNOWN·null로 읽는다
export const InvitedFriendSchema = invitedFriendResponseSchema.extend({
  joinedAt: z.coerce.date(),
  qualifiedAt: z.coerce.date().nullable(),
});

export type InvitedFriend = z.output<typeof InvitedFriendSchema>;

export function orderByJoinedAtDesc(friend: InvitedFriend) {
  return -friend.joinedAt.getTime();
}

// 발자국을 기다리는 친구가 먼저 보이게 한다. orderByJoinedAtDesc와 함께 쓴다
export function orderByWaitingFirst(friend: InvitedFriend) {
  return friend.status === 'JOINED' ? 0 : 1;
}

export function calculateActiveDaysLeft(activeDays: number, requiredDays: number) {
  return Math.max(requiredDays - activeDays, 0);
}

export function calculateHiddenCount(totalCount: number, visibleLimit: number) {
  return Math.max(totalCount - visibleLimit, 0);
}

const SUMMARY_LIMIT = 5;

export const InvitedFriendPolicy = {
  displayName(friend: InvitedFriend) {
    return toDisplayName(friend);
  },

  /** 발자국이 찍히려면 할 일을 해내야 하는 서로 다른 날 수 */
  requiredActiveDays() {
    return INVITE_QUALIFICATION.MIN_ACTIVE_DAYS;
  },

  /** 가입한 뒤 발자국을 남길 수 있는 기간(일) */
  qualificationWindowDays() {
    return INVITE_QUALIFICATION.EXPIRE_AFTER_DAYS;
  },

  activeDaysLeft(friend: InvitedFriend) {
    return calculateActiveDaysLeft(friend.activeDayCount, this.requiredActiveDays());
  },

  /** 내 초대 화면 요약에 보여 줄 친구. 정렬된 목록을 받는다 */
  summaryFriends(friends: readonly InvitedFriend[]) {
    return friends.slice(0, SUMMARY_LIMIT);
  },

  /** 요약 밖에 친구가 더 있어 전체 보기를 열지 */
  hasMoreThanSummary(totalCount: number) {
    return calculateHiddenCount(totalCount, SUMMARY_LIMIT) > 0;
  },

  /** 목록 행 칩: 발자국을 찍었는지, 기다리는 중인지, 보상에서 빠졌는지 */
  pawPrintState(friend: InvitedFriend) {
    return match(friend.status)
      .with('QUALIFIED', 'REWARDED', () => 'stamped' as const)
      .with('JOINED', () => 'waiting' as const)
      .with('REJECTED', () => 'excluded' as const)
      .with('UNKNOWN', () => 'unknown' as const)
      .exhaustive();
  },
};
