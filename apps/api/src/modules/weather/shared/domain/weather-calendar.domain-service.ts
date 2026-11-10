import { instantFromDate } from "#api/shared/domain/time/instant";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf } from "#api/shared/domain/time/zoned-time";

// 옛 날짜 함수(resolveTimezone)처럼 알 수 없는 시간대는 날씨 응답을 멈추지 않고 UTC로 계산한다
function toWeatherTimeZone(raw: string): TimeZone {
  try {
    return TimeZone.create(raw);
  } catch {
    return TimeZone.UTC;
  }
}

export function localDateTimeAt(at: Date, timezone: string): Temporal.ZonedDateTime {
  return instantFromDate(at).toZonedDateTimeISO(toWeatherTimeZone(timezone).value);
}

export function localDateAt(at: Date, timezone: string): Temporal.PlainDate {
  return localDateOf(instantFromDate(at), toWeatherTimeZone(timezone));
}

/** 서머타임으로 자정이 없는 날은 그날 첫 순간이다 */
export function startOfLocalDate(date: Temporal.PlainDate, timezone: string): Date {
  return new Date(date.toZonedDateTime(toWeatherTimeZone(timezone).value).epochMilliseconds);
}
