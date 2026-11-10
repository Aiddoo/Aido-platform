import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf, toZonedInstant } from "#api/shared/domain/time/zoned-time";

// 할 일 날짜 계산은 모두 Temporal로 한다. DB·응답 경계는 아직 YYYY-MM-DD 키와 UTC 자정 Date라 여기서 오간다

const UTC = "UTC";

// 옛 날짜 함수(resolveTimezone)처럼 알 수 없는 시간대는 요청을 멈추지 않고 UTC로 계산한다
export function toTodoTimeZone(raw: string): TimeZone {
  try {
    return TimeZone.create(raw);
  } catch {
    return TimeZone.UTC;
  }
}

export function plainDateOf(date: Date): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(UTC)
    .toPlainDate();
}

export function dateKeyOf(date: Date): string {
  return plainDateOf(date).toString();
}

/** DATE 칸이 쓰는 UTC 자정 Date */
export function utcMidnightOf(dateKey: string): Date {
  return new Date(Temporal.PlainDate.from(dateKey).toZonedDateTime(UTC).epochMilliseconds);
}

export function addDaysToKey(dateKey: string, days: number): string {
  return Temporal.PlainDate.from(dateKey).add({ days }).toString();
}

export function localDateKeyIn(at: Date, timezone: string): string {
  return localDateOf(
    Temporal.Instant.fromEpochMilliseconds(at.getTime()),
    toTodoTimeZone(timezone),
  ).toString();
}

/** 순간이 그 시간대에서 가리키는 벽시계(HH:mm). resolveScheduledInstant의 역변환이다. */
export function localTimeIn(at: Date, timezone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(at.getTime())
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
): Date | null {
  return localTime == null ? null : requireScheduledInstant(dateKey, localTime, timezone);
}

export function requireScheduledInstant(
  dateKey: string,
  localTime: string,
  timezone: string,
): Date {
  const instant = toZonedInstant({
    date: Temporal.PlainDate.from(dateKey),
    time: Temporal.PlainTime.from(localTime),
    timeZone: toTodoTimeZone(timezone),
  });
  return new Date(instant.epochMilliseconds);
}
