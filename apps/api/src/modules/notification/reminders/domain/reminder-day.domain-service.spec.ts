import {
  isoWeekRangeOf,
  localDayRangeAcross,
  localDaysSince,
  localStartOf,
  previousIsoWeekOf,
} from "./reminder-day.domain-service.js";

describe("리마인더 날짜 경계", () => {
  it.each([
    {
      label: "서울 가입 당일 저녁은 0일",
      since: "2026-11-10T10:00:00.000Z",
      today: "2026-11-10",
      timezone: "Asia/Seoul",
      expected: 0,
    },
    {
      label: "서울 저녁 19시 가입은 다음 현지 날 1일(UTC로는 같은 날)",
      since: "2026-11-10T10:00:00.000Z",
      today: "2026-11-11",
      timezone: "Asia/Seoul",
      expected: 1,
    },
    {
      label: "서울 2026-12-31 23:30 가입은 2027-01-01에 1일",
      since: "2026-12-31T14:30:00.000Z",
      today: "2027-01-01",
      timezone: "Asia/Seoul",
      expected: 1,
    },
    {
      label: "LA 2026-12-31 20:00 활동은 UTC로 2027-01-01이어도 2027-01-01에 1일",
      since: "2027-01-01T04:00:00.000Z",
      today: "2027-01-01",
      timezone: "America/Los_Angeles",
      expected: 1,
    },
    {
      label: "LA 2027-01-01 00:30 활동은 2027-01-02에 1일",
      since: "2027-01-01T08:30:00.000Z",
      today: "2027-01-02",
      timezone: "America/Los_Angeles",
      expected: 1,
    },
    {
      label: "윤일을 지나 2일",
      since: "2028-02-27T12:00:00.000Z",
      today: "2028-03-01",
      timezone: "UTC",
      expected: 3,
    },
  ])("localDaysSince: $label", ({ since, today, timezone, expected }) => {
    // When
    const days = localDaysSince(
      Temporal.Instant.from(since),
      Temporal.PlainDate.from(today),
      timezone,
    );

    // Then
    expect(days).toBe(expected);
  });

  it.each([
    { timezone: "Asia/Seoul", expected: "2026-12-31T15:00:00Z" },
    { timezone: "America/Los_Angeles", expected: "2027-01-01T08:00:00Z" },
  ])("localStartOf는 $timezone의 2027-01-01 현지 자정 순간이다", ({ timezone, expected }) => {
    // When
    const start = localStartOf(Temporal.PlainDate.from("2027-01-01"), timezone);

    // Then
    expect(start).toEqual(Temporal.Instant.from(expected));
  });

  it("localDayRangeAcross는 묶음의 시간대마다 그 현지 날짜가 되는 순간을 모두 덮는다", () => {
    // When
    // 2027-03-27 런던은 GMT(+0), 라고스는 +1이다
    const range = localDayRangeAcross(
      ["Europe/London", "Africa/Lagos"],
      Temporal.PlainDate.from("2027-03-27"),
      Temporal.PlainDate.from("2027-03-29"),
    );

    // Then
    expect(range).toEqual({
      since: Temporal.Instant.from("2027-03-26T23:00:00Z"),
      until: Temporal.Instant.from("2027-03-28T23:00:00Z"),
    });
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
    { date: "2026-03-02", start: "2026-03-02", end: "2026-03-09" },
    { date: "2026-03-08", start: "2026-03-02", end: "2026-03-09" },
    { date: "2027-01-03", start: "2026-12-28", end: "2027-01-04" },
  ])("isoWeekRangeOf($date)는 $start~$end 전", ({ date, start, end }) => {
    // When
    const week = isoWeekRangeOf(Temporal.PlainDate.from(date));

    // Then
    expect({ start: week.start.toString(), end: week.end.toString() }).toEqual({ start, end });
  });
});
