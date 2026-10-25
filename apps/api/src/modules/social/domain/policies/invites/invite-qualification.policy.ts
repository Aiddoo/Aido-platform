import { INVITE_QUALIFICATION } from "@aido/api/vocabulary";

import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type { InviteRedemption } from "../../aggregates/invites/invite-redemption.aggregate.js";

/** 할 일을 완료한 순간을 초대받은 사람 시간대의 달력 날짜로 바꾼다. */
export function localActivityDate(occurredAt: Date, timezone: string): string {
  return dayWindowInTimezone(occurredAt, timezone).localDate;
}

/** 서로 다른 날짜 MIN_ACTIVE_DAYS일에 할 일을 마치면 사용 시작이다. */
export function hasEnoughActiveDays(activeDayCount: number): boolean {
  return activeDayCount >= INVITE_QUALIFICATION.MIN_ACTIVE_DAYS;
}

export const InviteQualificationPolicy = {
  isQualified(redemption: InviteRedemption): boolean {
    return hasEnoughActiveDays(redemption.activeDays.length);
  },
};
