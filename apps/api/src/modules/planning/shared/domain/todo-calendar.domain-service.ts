import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf, toZonedInstant } from "#api/shared/domain/time/zoned-time";

// 할 일 날짜 계산은 모두 Temporal로 한다. 반복 규칙은 날짜를 YYYY-MM-DD 키로 들고 있어 여기서 오간다

// 옛 날짜 함수(resolveTimezone)처럼 알 수 없는 시간대는 요청을 멈추지 않고 UTC로 계산한다
function toTodoTimeZone(raw: string): TimeZone {
  try {
    return TimeZone.create(raw);
  } catch {
    return TimeZone.UTC;
  }
}

export function addDaysToKey(dateKey: string, days: number): string {
  return Temporal.PlainDate.from(dateKey).add({ days }).toString();
}

export function localDateAt(at: Temporal.Instant, timezone: string): Temporal.PlainDate {
  return localDateOf(at, toTodoTimeZone(timezone));
}

export function localDateKeyAt(at: Temporal.Instant, timezone: string): string {
  return localDateAt(at, timezone).toString();
}

/** 순간이 그 시간대에서 가리키는 벽시계(HH:mm). resolveScheduledInstant의 역변환이다. */
export function localTimeIn(at: Temporal.Instant, timezone: string): string {
  return at
    .toZonedDateTimeISO(toTodoTimeZone(timezone).value)
    .toPlainTime()
    .toString({ smallestUnit: "minute" });
}

/**
 * 할 일의 순간을 만드는 유일한 함수다. 경로마다 시간대를 해석하지 않는다.
 * 겹치는 벽시계는 앞쪽, 없는 벽시계는 전환 뒤로 보낸다(docs/conventions/dates.md).
 */
export function resolveScheduledInstant(
  dateKey: string,
  localTime: string | null,
  timezone: string,
): Temporal.Instant | null {
  if (localTime == null) {
    return null;
  }
  return toZonedInstant({
    date: Temporal.PlainDate.from(dateKey),
    time: Temporal.PlainTime.from(localTime),
    timeZone: toTodoTimeZone(timezone),
  });
}
