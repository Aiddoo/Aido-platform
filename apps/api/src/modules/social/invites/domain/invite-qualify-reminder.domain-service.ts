import { INVITE_QUALIFICATION } from "@aido/api/vocabulary";

import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf, toZonedInstant } from "#api/shared/domain/time/zoned-time";

import { INVITE_QUALIFY_REMINDER } from "./invites.constants.js";

const HOURS_PER_DAY = 24;

/** 사용 시작까지 하루만 남은 활동일 수. 이 수일 때만 "하루만 더"가 맞는 말이다. */
const ONE_DAY_LEFT_ACTIVE_DAYS = INVITE_QUALIFICATION.MIN_ACTIVE_DAYS - 1;

/**
 * 발송 시각은 배송 경로(resolveDeliveryTimezone)와 같이 미상·UTC 시간대를 KST로 본다. 잔존 UTC는 헤더를
 * 못 받아 기본값에 머문 한국 사용자가 대부분이다.
 */
export function deliveryTimeZoneOf(timeZone: TimeZone): TimeZone {
  try {
    const resolved = TimeZone.create(timeZone.value);
    return resolved.equals(TimeZone.UTC) ? TimeZone.SEOUL : resolved;
  } catch {
    return TimeZone.SEOUL;
  }
}

/** 이 시각 이전에 마감되는 수락이 알림 후보다. */
export function qualifyReminderExpiresBefore(now: Temporal.Instant): Temporal.Instant {
  return now.add({ hours: INVITE_QUALIFY_REMINDER.LEAD_DAYS * HOURS_PER_DAY });
}

/** 후보 조회와 발송 시 재확인에 같은 활동일 수 기준을 쓴다. */
export function hasOneActiveDayLeft(activeDayCount: number): boolean {
  return activeDayCount === ONE_DAY_LEFT_ACTIVE_DAYS;
}

/** now 이후 가장 가까운 로컬 발송 시각. 날짜로 다음 날을 구해 DST 날짜에서도 같은 벽시계 시각이다. */
export function nextQualifyReminderAt(params: {
  readonly now: Temporal.Instant;
  readonly timeZone: TimeZone;
}): Temporal.Instant {
  const timeZone = deliveryTimeZoneOf(params.timeZone);
  const time = Temporal.PlainTime.from(INVITE_QUALIFY_REMINDER.LOCAL_TIME);
  const today = localDateOf(params.now, timeZone);
  const todaySlot = toZonedInstant({ date: today, time, timeZone });
  if (Temporal.Instant.compare(todaySlot, params.now) > 0) {
    return todaySlot;
  }
  return toZonedInstant({ date: today.add({ days: 1 }), time, timeZone });
}
