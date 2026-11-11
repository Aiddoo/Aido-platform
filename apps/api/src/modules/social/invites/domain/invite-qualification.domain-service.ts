import { INVITE_QUALIFICATION } from "@aido/api/vocabulary";

import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf } from "#api/shared/domain/time/zoned-time";

const HOURS_PER_DAY = 24;

// 알 수 없는 저장값은 활동일 계산을 멈추지 않고 UTC 날짜로 센다
function activityTimeZoneOf(timeZone: TimeZone): TimeZone {
  try {
    return TimeZone.create(timeZone.value);
  } catch {
    return TimeZone.UTC;
  }
}

/** 할 일을 완료한 순간을 초대받은 사람 시간대의 달력 날짜로 바꾼다. */
export function localActivityDate(
  occurredAt: Temporal.Instant,
  timeZone: TimeZone,
): Temporal.PlainDate {
  return localDateOf(occurredAt, activityTimeZoneOf(timeZone));
}

/** 서로 다른 날짜 MIN_ACTIVE_DAYS일에 할 일을 마치면 사용 시작이다. */
export function hasEnoughActiveDays(activeDayCount: number): boolean {
  return activeDayCount >= INVITE_QUALIFICATION.MIN_ACTIVE_DAYS;
}

/** 수락한 순간에서 EXPIRE_AFTER_DAYS일(24시간 단위) 뒤가 사용 시작 마감이다. */
export function qualificationExpiresAt(joinedAt: Temporal.Instant): Temporal.Instant {
  return joinedAt.add({ hours: INVITE_QUALIFICATION.EXPIRE_AFTER_DAYS * HOURS_PER_DAY });
}
