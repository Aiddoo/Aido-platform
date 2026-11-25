import { readFileSync } from "node:fs";

import { z } from "zod";

import {
  isSameTimezone,
  isUtcOffsetTimezone,
  localDateIn,
  parseDeviceReportedTimezone,
  parseTimezoneName,
  resolveDateBoundaryTimezone,
  resolveDeliveryTimezone,
  resolveWallClockTimezone,
} from "./timezone-name.js";

/** 기기가 보고한 시간대를 읽는 규칙. 서버와 앱이 같은 답을 내야 하는 표다 */
const SHARED_TIMEZONE_REPORT_CASES = z
  .object({
    deviceReportedTimezone: z.array(
      z.object({
        name: z.string(),
        value: z.string().nullable(),
        reported: z.string().nullable(),
      }),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../../../../packages/api/test/fixtures/timezone-report-cases.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );

// 바깥 시간대 입력 하나를 해석 함수와 세 대체 정책에 넣은 결과. 바뀌면 사용자 시각이 바뀌므로 표 전체를 고정한다
const TIMEZONE_INPUT_CASES = [
  {
    raw: "Asia/Seoul",
    parsed: "Asia/Seoul",
    dateBoundary: "Asia/Seoul",
    delivery: "Asia/Seoul",
    wallClock: "Asia/Seoul",
  },
  {
    raw: "asia/seoul",
    parsed: "Asia/Seoul",
    dateBoundary: "Asia/Seoul",
    delivery: "Asia/Seoul",
    wallClock: "Asia/Seoul",
  },
  {
    raw: "Asia/Kolkata",
    parsed: "Asia/Kolkata",
    dateBoundary: "Asia/Kolkata",
    delivery: "Asia/Kolkata",
    wallClock: "Asia/Kolkata",
  },
  {
    raw: "Asia/Calcutta",
    parsed: "Asia/Calcutta",
    dateBoundary: "Asia/Calcutta",
    delivery: "Asia/Calcutta",
    wallClock: "Asia/Calcutta",
  },
  {
    raw: "US/Pacific",
    parsed: "US/Pacific",
    dateBoundary: "US/Pacific",
    delivery: "US/Pacific",
    wallClock: "US/Pacific",
  },
  { raw: "UTC", parsed: "UTC", dateBoundary: "UTC", delivery: "Asia/Seoul", wallClock: "UTC" },
  {
    raw: "Etc/UTC",
    parsed: "Etc/UTC",
    dateBoundary: "Etc/UTC",
    delivery: "Asia/Seoul",
    wallClock: "Etc/UTC",
  },
  { raw: "GMT", parsed: "GMT", dateBoundary: "GMT", delivery: "Asia/Seoul", wallClock: "GMT" },
  {
    raw: "+09:00",
    parsed: null,
    dateBoundary: "UTC",
    delivery: "Asia/Seoul",
    wallClock: "Asia/Seoul",
  },
  {
    raw: "-05:00",
    parsed: null,
    dateBoundary: "UTC",
    delivery: "Asia/Seoul",
    wallClock: "Asia/Seoul",
  },
  { raw: "", parsed: null, dateBoundary: "UTC", delivery: "Asia/Seoul", wallClock: "Asia/Seoul" },
  { raw: "  ", parsed: null, dateBoundary: "UTC", delivery: "Asia/Seoul", wallClock: "Asia/Seoul" },
  {
    raw: "Mars/Olympus",
    parsed: null,
    dateBoundary: "UTC",
    delivery: "Asia/Seoul",
    wallClock: "Asia/Seoul",
  },
  { raw: null, parsed: null, dateBoundary: "UTC", delivery: "Asia/Seoul", wallClock: "Asia/Seoul" },
  { raw: 900, parsed: null, dateBoundary: "UTC", delivery: "Asia/Seoul", wallClock: "Asia/Seoul" },
] as const;

describe("시간대 이름 해석", () => {
  it.each(TIMEZONE_INPUT_CASES)(
    "$raw: 해석 $parsed, 날짜 경계 $dateBoundary, 발송 $delivery, 벽시계 $wallClock",
    ({ raw, parsed, dateBoundary, delivery, wallClock }) => {
      // When
      const resolved = {
        parsed: parseTimezoneName(raw),
        dateBoundary: resolveDateBoundaryTimezone(raw),
        delivery: resolveDeliveryTimezone(raw),
        wallClock: resolveWallClockTimezone(raw),
      };

      // Then
      expect(resolved).toEqual({ parsed, dateBoundary, delivery, wallClock });
    },
  );

  it.each([
    { raw: "+09:00", expected: true },
    { raw: "+0900", expected: true },
    { raw: "Asia/Seoul", expected: false },
    { raw: "Mars/Olympus", expected: false },
    { raw: null, expected: false },
  ])("isUtcOffsetTimezone($raw)는 $expected다", ({ raw, expected }) => {
    // When
    const isOffset = isUtcOffsetTimezone(raw);

    // Then
    expect(isOffset).toBe(expected);
  });

  it.each([
    { left: "Asia/Calcutta", right: "Asia/Kolkata", expected: true },
    { left: "Europe/Kiev", right: "Europe/Kyiv", expected: true },
    { left: "asia/seoul", right: "Asia/Seoul", expected: true },
    { left: "Asia/Seoul", right: "Asia/Tokyo", expected: false },
    { left: "Mars/Olympus", right: "Asia/Seoul", expected: false },
    { left: "+09:00", right: "Asia/Seoul", expected: false },
    { left: null, right: "Asia/Seoul", expected: false },
  ])("isSameTimezone($left, $right)는 $expected다", ({ left, right, expected }) => {
    // When
    const isSame = isSameTimezone(left, right);

    // Then
    expect(isSame).toBe(expected);
  });

  it.each(SHARED_TIMEZONE_REPORT_CASES.deviceReportedTimezone)(
    "기기 보고 시간대 표: $name",
    ({ value, reported }) => {
      // When
      const timezone = parseDeviceReportedTimezone(value);

      // Then
      expect(timezone).toBe(reported);
    },
  );

  it("벽시계용 해석은 앞선 유효 후보를 쓰고 저장된 UTC를 그대로 둔다", () => {
    // Given
    const requested = "+09:00";
    const stored = "UTC";

    // When
    const timezone = resolveWallClockTimezone(requested, stored);

    // Then
    expect(timezone).toBe("UTC");
    expect(resolveWallClockTimezone(undefined, null)).toBe("Asia/Seoul");
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
    {
      label: "고정 오프셋은 UTC",
      at: "2026-11-09T20:00:00.000Z",
      zone: "+09:00",
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
