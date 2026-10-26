import { INVITE_QUALIFICATION, REDEMPTION_STATUS } from "@aido/api/vocabulary";

import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import {
  dayWindowInTimezone,
  parseLocalDateTime,
  resolveDeliveryTimezone,
} from "#api/shared/domain/date/utils/timezone";

import type { InviteRedemption } from "../../aggregates/invites/invite-redemption.aggregate.js";
import { localActivityDate } from "./invite-qualification.policy.js";

export const INVITE_QUALIFY_REMINDER = {
  /** 사용 시작 마감이 이 일수 안으로 들어온 수락만 알린다. 정비 작업이 하루 한 번 돌아 마감 2~3일 전에 고른다. */
  LEAD_DAYS: 3,
  /** 초대받은 사람 시간대의 이 시각에 보낸다. 할 일을 마무리하는 저녁이면서 야간(21시) 전이다. */
  LOCAL_TIME: "18:00",
} as const;

/** 사용 시작까지 하루만 남은 활동일 수. 이 수일 때만 "하루만 더"가 맞는 말이다. */
const ONE_DAY_LEFT_ACTIVE_DAYS = INVITE_QUALIFICATION.MIN_ACTIVE_DAYS - 1;

/** 방금 기록한 날이 첫 활동일인지. 같은 수락의 활동일 기록은 행 잠금으로 직렬화되므로 한 번만 참이다. */
export function isFirstActiveDay(redemption: InviteRedemption): boolean {
  return redemption.activeDays.length === 1;
}

/** 이 시각 이전에 마감되는 수락이 알림 후보다. */
export function qualifyReminderExpiresBefore(now: Date): Date {
  return addDays(INVITE_QUALIFY_REMINDER.LEAD_DAYS, now);
}

/** 후보 조회와 발송 시 재확인에 같은 활동일 수 기준을 쓴다. */
export function hasOneActiveDayLeft(activeDayCount: number): boolean {
  return activeDayCount === ONE_DAY_LEFT_ACTIVE_DAYS;
}

/**
 * now 이후 가장 가까운 로컬 발송 시각. 날짜 label로 다음 날을 구해 DST 날짜에서도 같은 벽시계 시각이다.
 * 발송 시각은 배송 경로와 같이 미상·UTC 시간대를 KST로 본다.
 */
export function nextQualifyReminderAt(now: Date, inviteeTimezone: string): Date {
  const timezone = resolveDeliveryTimezone(inviteeTimezone);
  const today = dayWindowInTimezone(now, timezone);
  const todaySlot = parseLocalDateTime(
    today.localDate,
    INVITE_QUALIFY_REMINDER.LOCAL_TIME,
    timezone,
  );
  if (todaySlot.getTime() > now.getTime()) return todaySlot;
  const tomorrow = dayWindowInTimezone(today.endsAt, timezone).localDate;
  return parseLocalDateTime(tomorrow, INVITE_QUALIFY_REMINDER.LOCAL_TIME, timezone);
}

export const InviteQualifyReminderPolicy = {
  /**
   * 하루만 더 하면 사용 시작인 수락에 마감 전 한 번 알린다. 초대한 사람 보상이 없는 수락은 "발자국을
   * 선물"이 사실이 아니라 보내지 않는다. 오늘 이미 할 일을 끝냈다면 오늘은 더 셀 수 없어 다음 실행으로 넘긴다.
   */
  isDue(redemption: InviteRedemption, now: Date): boolean {
    return (
      redemption.status === REDEMPTION_STATUS.JOINED &&
      redemption.inviterId != null &&
      redemption.inviterRewardEligible &&
      redemption.qualifyReminderSentAt == null &&
      hasOneActiveDayLeft(redemption.activeDays.length) &&
      !redemption.isExpiredAt(now) &&
      redemption.expiresAt.getTime() <= qualifyReminderExpiresBefore(now).getTime() &&
      !redemption.activeDays.includes(localActivityDate(now, redemption.timezone))
    );
  },
};
