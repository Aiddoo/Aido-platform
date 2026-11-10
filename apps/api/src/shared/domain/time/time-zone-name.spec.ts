import {
  DEFAULT_DELIVERY_TIMEZONE,
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
});
