import { QuotaWindow } from "./quota-window.vo.js";

function zoned(localDateTime: string, timeZone: string): Temporal.Instant {
  return Temporal.PlainDateTime.from(localDateTime).toZonedDateTime(timeZone).toInstant();
}

describe("QuotaWindow — 월간 quota 기간(KST 달력 월)", () => {
  it.each([
    { at: "2026-04-30T14:59:59.999Z", period: "2026-M04", next: "2026-04-30T15:00:00.000Z" },
    { at: "2026-04-30T15:00:00.000Z", period: "2026-M05", next: "2026-05-31T15:00:00.000Z" },
    { at: "2026-02-28T15:00:00.000Z", period: "2026-M03", next: "2026-03-31T15:00:00.000Z" },
    { at: "2028-02-29T15:00:00.000Z", period: "2028-M03", next: "2028-03-31T15:00:00.000Z" },
    { at: "2026-12-31T15:00:00.000Z", period: "2027-M01", next: "2027-01-31T15:00:00.000Z" },
  ])("$at 의 기간은 $period 이고 다음 리셋은 $next 이다", ({ at, period, next }) => {
    // Given
    const now = Temporal.Instant.from(at);

    // When
    const window = QuotaWindow.monthOf(now);

    // Then
    expect(window.periodKey).toBe(period);
    expect(window.resetsAt.toString({ fractionalSecondDigits: 3 })).toBe(next);
    expect(window.contains(now)).toBe(true);
  });

  it.each([
    {
      label: "서울 4월 30일 23:59:59",
      local: "2026-04-30T23:59:59",
      timeZone: "Asia/Seoul",
      period: "2026-M04",
    },
    {
      label: "서울 5월 1일 00:00",
      local: "2026-05-01T00:00:00",
      timeZone: "Asia/Seoul",
      period: "2026-M05",
    },
    // LA는 아직 4월 30일이지만 KST로는 5월 1일 15:59라 5월 기간이다
    {
      label: "LA 4월 30일 23:59",
      local: "2026-04-30T23:59:00",
      timeZone: "America/Los_Angeles",
      period: "2026-M05",
    },
    // LA 4월 30일 07:59(PDT)는 KST 4월 30일 23:59라 아직 4월 기간이다
    {
      label: "LA 4월 30일 07:59",
      local: "2026-04-30T07:59:00",
      timeZone: "America/Los_Angeles",
      period: "2026-M04",
    },
    {
      label: "LA 4월 30일 08:00",
      local: "2026-04-30T08:00:00",
      timeZone: "America/Los_Angeles",
      period: "2026-M05",
    },
  ])(
    "사용자 시간대와 무관하게 KST 달력 월을 쓴다: $label → $period",
    ({ local, timeZone, period }) => {
      // Given
      const now = zoned(local, timeZone);

      // When
      const window = QuotaWindow.monthOf(now);

      // Then
      expect(window.periodKey).toBe(period);
    },
  );

  it("UTC 날짜가 같아도 KST 월 경계 전후는 다른 기간이고 기록이 없으면 0으로 본다", () => {
    // Given
    const window = QuotaWindow.monthOf(Temporal.Instant.from("2026-04-30T15:00:00Z"));

    // When
    const contained = [
      window.contains(Temporal.Instant.from("2026-04-30T14:59:59Z")),
      window.contains(Temporal.Instant.from("2026-05-31T14:59:59Z")),
      window.contains(Temporal.Instant.from("2026-05-31T15:00:00Z")),
      window.contains(null),
    ];

    // Then
    expect(contained).toEqual([false, true, false, false]);
  });

  it("같은 달의 서로 다른 시각은 같은 기간이다", () => {
    // Given
    const early = QuotaWindow.monthOf(Temporal.Instant.from("2026-04-01T00:00:00Z"));

    // When
    const late = QuotaWindow.monthOf(Temporal.Instant.from("2026-04-29T00:00:00Z"));

    // Then
    expect(early.equals(late)).toBe(true);
  });
});
