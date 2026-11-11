// 날짜를 아직 UTC 자정 Date로 다루는 Context와의 경계에서만 쓴다
export function plainDateFromDate(utcMidnight: Date): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(utcMidnight.getTime())
    .toZonedDateTimeISO("UTC")
    .toPlainDate();
}

export function plainDateToDate(date: Temporal.PlainDate): Date {
  return new Date(date.toZonedDateTime("UTC").epochMilliseconds);
}
