import {
  localDateAt,
  localDateTimeAt,
  startOfLocalDate,
} from "./weather-calendar.domain-service.js";

describe("weather-calendar — 위치·기기 시간대의 달력", () => {
  it.each([
    {
      name: "서울 자정 직전",
      at: "2026-11-09T14:59:59.999Z",
      zone: "Asia/Seoul",
      date: "2026-11-09",
    },
    { name: "서울 자정", at: "2026-11-09T15:00:00.000Z", zone: "Asia/Seoul", date: "2026-11-10" },
    {
      name: "같은 순간 LA는 전날",
      at: "2026-11-09T15:00:00.000Z",
      zone: "America/Los_Angeles",
      date: "2026-11-09",
    },
    {
      name: "LA 월말 밤은 UTC로는 다음 달",
      at: "2026-12-01T07:59:00.000Z",
      zone: "America/Los_Angeles",
      date: "2026-11-30",
    },
    {
      name: "알 수 없는 시간대는 UTC",
      at: "2026-11-09T23:30:00.000Z",
      zone: "Mars/Base",
      date: "2026-11-09",
    },
  ])("$name: $at은 $zone의 $date이다", ({ at, zone, date }) => {
    // Given
    const instant = new Date(at);
    // When
    const localDate = localDateAt(instant, zone);
    // Then
    expect(localDate.toString()).toBe(date);
  });

  it("LA 서머타임이 끝나는 날의 01:30은 두 번 오고 각각 PDT·PST 시각이다", () => {
    // Given
    const first = new Date("2026-11-01T08:30:00.000Z");
    const second = new Date("2026-11-01T09:30:00.000Z");
    // When
    const [firstLocal, secondLocal] = [first, second].map((at) =>
      localDateTimeAt(at, "America/Los_Angeles"),
    );
    // Then
    expect([firstLocal?.hour, firstLocal?.minute, firstLocal?.offset]).toEqual([1, 30, "-07:00"]);
    expect([secondLocal?.hour, secondLocal?.minute, secondLocal?.offset]).toEqual([
      1,
      30,
      "-08:00",
    ]);
  });

  it.each([
    {
      name: "LA 서머타임 시작일은 23시간이라 다음 날 자정까지 23시간이다",
      date: "2026-03-08",
      start: "2026-03-08T08:00:00.000Z",
      next: "2026-03-09T07:00:00.000Z",
    },
    {
      name: "LA 서머타임 종료일은 25시간이라 다음 날 자정까지 25시간이다",
      date: "2026-11-01",
      start: "2026-11-01T07:00:00.000Z",
      next: "2026-11-02T08:00:00.000Z",
    },
  ])("$name", ({ date, start, next }) => {
    // Given
    const localDate = Temporal.PlainDate.from(date);
    // When
    const startsAt = startOfLocalDate(localDate, "America/Los_Angeles");
    const endsAt = startOfLocalDate(localDate.add({ days: 1 }), "America/Los_Angeles");
    // Then
    expect([startsAt.toISOString(), endsAt.toISOString()]).toEqual([start, next]);
  });
});
