import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { toZonedInstant } from "#api/shared/domain/time/zoned-time";

// vi.useFakeTimers는 Date만 움직이고 Temporal.Now는 그대로라 테스트 시드의 지금은 Date.now()에서 만든다
export function nowInstant(): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(Date.now());
}

/** 시드의 날짜 칸에 넣는 지금의 UTC 달력 날짜. 옛 시드가 넣던 `new Date()`와 같은 날이다 */
export function todayUtc(): Temporal.PlainDate {
  return nowInstant().toZonedDateTimeISO("UTC").toPlainDate();
}

/** YYYY-MM-DD 달력 날짜에 일수를 더한다 */
export function shiftDateKey(dateKey: string, days: number): string {
  return Temporal.PlainDate.from(dateKey).add({ days }).toString();
}

/** 그 시간대의 오늘 달력 날짜 */
export function todayIn(timezone: string): Temporal.PlainDate {
  return nowInstant().toZonedDateTimeISO(timezone).toPlainDate();
}

/** 그 시간대 벽시계 날짜·시각의 순간. 겹치는 시각은 앞쪽, 없는 시각은 전환 뒤다 */
export function wallClockInstant(
  date: string | Temporal.PlainDate,
  time: string,
  timezone: string,
): Temporal.Instant {
  return toZonedInstant({
    date: Temporal.PlainDate.from(date),
    time: Temporal.PlainTime.from(time),
    timeZone: TimeZone.create(timezone),
  });
}

/** 그 순간이 속한 시간대 하루의 시작과 다음 날 시작 */
export function dayWindowIn(
  at: Temporal.Instant,
  timezone: string,
): { readonly startsAt: Temporal.Instant; readonly endsAt: Temporal.Instant } {
  const day = at.toZonedDateTimeISO(timezone).toPlainDate();
  return {
    startsAt: day.toZonedDateTime(timezone).toInstant(),
    endsAt: day.add({ days: 1 }).toZonedDateTime(timezone).toInstant(),
  };
}
