import type { TimeZone } from "./time-zone.vo.js";

export function toZonedInstant(params: {
  readonly date: Temporal.PlainDate;
  readonly time: Temporal.PlainTime;
  readonly timeZone: TimeZone;
}): Temporal.Instant {
  // "compatible"은 겹치는 시각은 앞쪽, 없는 시각은 전환 뒤로 보내 날짜 규칙과 같다
  return params.date
    .toPlainDateTime(params.time)
    .toZonedDateTime(params.timeZone.value, { disambiguation: "compatible" })
    .toInstant();
}

export function localDateOf(instant: Temporal.Instant, timeZone: TimeZone): Temporal.PlainDate {
  return instant.toZonedDateTimeISO(timeZone.value).toPlainDate();
}
