// vi.useFakeTimers는 Date만 움직이고 Temporal.Now는 그대로라 테스트 시드의 지금은 Date.now()에서 만든다
export function nowInstant(): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(Date.now());
}

/** 시드의 날짜 칸에 넣는 지금의 UTC 달력 날짜. 옛 시드가 넣던 `new Date()`와 같은 날이다 */
export function todayUtc(): Temporal.PlainDate {
  return nowInstant().toZonedDateTimeISO("UTC").toPlainDate();
}
