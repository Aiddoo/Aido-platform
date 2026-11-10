import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

// planning Todo의 date 칸은 아직 UTC 자정 Date로 오가므로 달력 날짜와의 변환을 이 한 곳에 둔다
export function toCalendarDate(columnValue: Date): Temporal.PlainDate {
  return instantFromDate(columnValue).toZonedDateTimeISO("UTC").toPlainDate();
}

export function toDateColumnValue(date: Temporal.PlainDate): Date {
  return instantToDate(date.toZonedDateTime("UTC").toInstant());
}
