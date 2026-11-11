import { NIGHT_TIME_CONFIG } from "@aido/api/vocabulary";

import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { isWithinQuietHours, PUSH_QUIET_HOURS_WINDOW } from "./quiet-hours.domain-service.js";

function quietAt(iso: string, timeZone: string): boolean {
  return isWithinQuietHours({
    instant: Temporal.Instant.from(iso),
    timeZone: TimeZone.reconstitute(timeZone),
    window: PUSH_QUIET_HOURS_WINDOW,
  });
}

describe("isWithinQuietHours — 푸시 방해 금지 시간", () => {
  // 야간: 현지 21:00 이상 ~ 08:00 미만
  it.each([
    { label: "KST 21:00", iso: "2024-01-15T12:00:00Z" },
    { label: "KST 22:30", iso: "2024-01-15T13:30:00Z" },
    { label: "KST 23:59", iso: "2024-01-15T14:59:00Z" },
    { label: "KST 00:00", iso: "2024-01-15T15:00:00Z" },
    { label: "KST 03:00", iso: "2024-01-15T18:00:00Z" },
    { label: "KST 07:59", iso: "2024-01-15T22:59:00Z" },
  ])("$label은 야간이다", ({ iso }) => {
    // Given
    const timeZone = "Asia/Seoul";

    // When
    const quiet = quietAt(iso, timeZone);

    // Then
    expect(quiet).toBe(true);
  });

  it.each([
    { label: "KST 08:00", iso: "2024-01-15T23:00:00Z" },
    { label: "KST 12:00", iso: "2024-01-15T03:00:00Z" },
    { label: "KST 20:00", iso: "2024-01-15T11:00:00Z" },
    { label: "KST 20:59", iso: "2024-01-15T11:59:00Z" },
  ])("$label은 주간이다", ({ iso }) => {
    // Given
    const timeZone = "Asia/Seoul";

    // When
    const quiet = quietAt(iso, timeZone);

    // Then
    expect(quiet).toBe(false);
  });

  it.each([
    { iso: "2024-01-15T21:00:00Z", quiet: true },
    { iso: "2024-01-15T12:00:00Z", quiet: false },
  ])("UTC 시간대에서 $iso의 야간 여부는 $quiet다", ({ iso, quiet }) => {
    // Given
    const timeZone = "UTC";

    // When
    const result = quietAt(iso, timeZone);

    // Then
    expect(result).toBe(quiet);
  });

  it("자정을 넘지 않는 구간은 시작 이상 끝 미만만 조용한 시간이다", () => {
    // Given
    const window = {
      start: Temporal.PlainTime.from("13:00"),
      end: Temporal.PlainTime.from("14:00"),
    };
    const timeZone = TimeZone.reconstitute("UTC");

    // When
    const results = ["12:59", "13:00", "13:59", "14:00"].map((time) =>
      isWithinQuietHours({
        instant: Temporal.Instant.from(`2024-01-15T${time}:00Z`),
        timeZone,
        window,
      }),
    );

    // Then
    expect(results).toEqual([false, true, true, false]);
  });

  it("기본 창은 정보통신망법 야간 21시~8시다", () => {
    // Given
    const window = PUSH_QUIET_HOURS_WINDOW;

    // When
    const hours = [window.start.hour, window.end.hour];

    // Then
    expect(hours).toEqual([NIGHT_TIME_CONFIG.START_HOUR, NIGHT_TIME_CONFIG.END_HOUR]);
    expect(hours).toEqual([21, 8]);
  });
});
