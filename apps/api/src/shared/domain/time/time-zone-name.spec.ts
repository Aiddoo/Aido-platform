import {
  DEFAULT_DELIVERY_TIMEZONE,
  localDateIn,
  normalizeIanaTimezone,
  resolveDeliveryTimezone,
  resolveTimezone,
  resolveWallClockTimezone,
} from "./time-zone-name.js";

describe("시간대 이름 해석", () => {
  it.each([
    { raw: "Asia/Seoul", expected: "Asia/Seoul" },
    { raw: "America/Los_Angeles", expected: "America/Los_Angeles" },
    { raw: "Mars/Olympus", expected: null },
    { raw: "  ", expected: null },
    { raw: 900, expected: null },
  ])("normalizeIanaTimezone($raw)는 $expected다", ({ raw, expected }) => {
    // Given·When
    const normalized = normalizeIanaTimezone(raw);

    // Then
    expect(normalized).toBe(expected);
  });

  it("날짜 경계용 해석은 잘못된 값을 UTC로 본다", () => {
    // Given
    const stored = "Mars/Olympus";

    // When
    const timezone = resolveTimezone(stored);

    // Then
    expect(timezone).toBe("UTC");
  });

  it.each([
    { raw: "UTC", expected: DEFAULT_DELIVERY_TIMEZONE },
    { raw: null, expected: DEFAULT_DELIVERY_TIMEZONE },
    { raw: "America/Los_Angeles", expected: "America/Los_Angeles" },
  ])("발송용 해석은 $raw를 $expected로 본다", ({ raw, expected }) => {
    // Given·When
    const timezone = resolveDeliveryTimezone(raw);

    // Then
    expect(timezone).toBe(expected);
  });

  it("벽시계용 해석은 앞선 유효 후보를 쓰고 저장된 UTC를 그대로 둔다", () => {
    // Given
    const requested = "invalid";
    const stored = "UTC";

    // When
    const timezone = resolveWallClockTimezone(requested, stored);

    // Then
    expect(timezone).toBe("UTC");
    expect(resolveWallClockTimezone(undefined, null)).toBe(DEFAULT_DELIVERY_TIMEZONE);
  });

  it.each([
    {
      label: "서울 자정 직전",
      at: "2026-11-09T14:59:59.999Z",
      zone: "Asia/Seoul",
      date: "2026-11-09",
    },
    { label: "서울 자정", at: "2026-11-09T15:00:00.000Z", zone: "Asia/Seoul", date: "2026-11-10" },
    {
      label: "LA 서머타임 종료일",
      at: "2026-11-01T08:30:00.000Z",
      zone: "America/Los_Angeles",
      date: "2026-11-01",
    },
    { label: "윤일", at: "2028-02-29T12:00:00.000Z", zone: "UTC", date: "2028-02-29" },
    {
      label: "잘못된 시간대는 UTC",
      at: "2026-11-09T20:00:00.000Z",
      zone: "Mars/Olympus",
      date: "2026-11-09",
    },
  ])("localDateIn: $label", ({ at, zone, date }) => {
    // Given
    const instant = Temporal.Instant.from(at);

    // When
    const localDate = localDateIn(instant, zone);

    // Then
    expect(localDate.toString()).toBe(date);
  });
});
