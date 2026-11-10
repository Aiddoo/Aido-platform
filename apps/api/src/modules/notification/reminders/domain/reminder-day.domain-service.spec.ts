import {
  elapsedDaysUntil,
  isoWeekIdOf,
  previousIsoWeekOf,
  utcStartOf,
} from "./reminder-day.domain-service.js";

describe("리마인더 날짜 경계", () => {
  it.each([
    { label: "같은 날 오후 가입은 0일", since: "2026-11-10T03:00:00.000Z", expected: 0 },
    { label: "어제 자정 직후는 0일(24시간 미만)", since: "2026-11-09T00:00:00.001Z", expected: 0 },
    { label: "어제 UTC 자정은 1일", since: "2026-11-09T00:00:00.000Z", expected: 1 },
    { label: "서울 어제 저녁(UTC 그제)은 1일", since: "2026-11-08T15:00:00.000Z", expected: 1 },
    {
      label: "윤일을 지나 2일",
      since: "2028-02-27T12:00:00.000Z",
      today: "2028-03-01",
      expected: 2,
    },
  ])("elapsedDaysUntil: $label", ({ since, today, expected }) => {
    // Given
    const date = Temporal.PlainDate.from(today ?? "2026-11-10");

    // When
    const days = elapsedDaysUntil(date, Temporal.Instant.from(since));

    // Then
    expect(days).toBe(expected);
  });

  it("오늘의 UTC 자정 순간을 구간 경계로 쓴다", () => {
    // Given
    const today = Temporal.PlainDate.from("2026-03-08");

    // When
    const start = utcStartOf(today);

    // Then
    expect(start).toEqual(Temporal.Instant.from("2026-03-08T00:00:00Z"));
  });

  it.each([
    { today: "2026-11-09", start: "2026-11-02", end: "2026-11-09", isoYear: 2026, isoWeek: 45 },
    { today: "2026-11-15", start: "2026-11-02", end: "2026-11-09", isoYear: 2026, isoWeek: 45 },
    { today: "2027-01-04", start: "2026-12-28", end: "2027-01-04", isoYear: 2026, isoWeek: 53 },
    { today: "2026-01-05", start: "2025-12-29", end: "2026-01-05", isoYear: 2026, isoWeek: 1 },
  ])("previousIsoWeekOf($today)는 $start~$end, $isoYear-W$isoWeek", (row) => {
    // Given
    const today = Temporal.PlainDate.from(row.today);

    // When
    const week = previousIsoWeekOf(today);

    // Then
    expect({
      start: week.start.toString(),
      end: week.end.toString(),
      isoYear: week.isoYear,
      isoWeek: week.isoWeek,
    }).toEqual({ start: row.start, end: row.end, isoYear: row.isoYear, isoWeek: row.isoWeek });
  });

  it.each([
    { date: "2026-03-04", expected: "2026-W10" },
    { date: "2026-12-31", expected: "2026-W53" },
    { date: "2027-01-03", expected: "2026-W53" },
  ])("isoWeekIdOf($date) = $expected", ({ date, expected }) => {
    // Given·When
    const weekId = isoWeekIdOf(Temporal.PlainDate.from(date));

    // Then
    expect(weekId).toBe(expected);
  });
});
