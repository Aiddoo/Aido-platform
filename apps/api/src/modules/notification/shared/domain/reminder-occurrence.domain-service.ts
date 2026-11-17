import type { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { toZonedInstant } from "#api/shared/domain/time/zoned-time";

/**
 * 같은 할 일의 같은 단계를 한 번만 보내는 회차 값. 날짜와 벽시계로 만든다.
 *
 * 시간대 재계산은 날짜와 벽시계를 바꾸지 않아 값이 그대로이고, 사용자가 날짜나 시간을 고치면 값이 달라진다.
 * 벽시계가 빈 행(롤백 중 옛 서버가 쓴 행)은 날짜만 쓴다.
 */
export function createReminderOccurrenceKey(
  startDate: string,
  scheduledLocalTime: string | null,
): string {
  return scheduledLocalTime == null ? startDate : `${startDate}T${scheduledLocalTime}`;
}

/** 회차가 시작하는 순간. 할 일 순간과 같이 날짜 + 벽시계 + 받는 사람 시간대로 만든다. 벽시계가 없으면 null이다 */
export function reminderOccurrenceStart(
  occurrenceKey: string,
  timeZone: TimeZone,
): Temporal.Instant | null {
  const [date, time] = occurrenceKey.split("T");
  if (date == null || time == null) {
    return null;
  }
  // 형식이 다른 옛 값은 발송을 막지 않고 종류 기본 보관 시간으로 보낸다
  try {
    return toZonedInstant({
      date: Temporal.PlainDate.from(date),
      time: Temporal.PlainTime.from(time),
      timeZone,
    });
  } catch {
    return null;
  }
}
