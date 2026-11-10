import { TimeZone } from "./time-zone.vo.js";
import { localDateOf, toZonedInstant } from "./zoned-time.js";

const LOS_ANGELES = TimeZone.create("America/Los_Angeles");

describe("toZonedInstant — 떠 있는 시각을 순간으로", () => {
  it.each([
    {
      label: "서울 오전 10시",
      date: "2026-11-10",
      time: "10:00",
      timeZone: TimeZone.SEOUL,
      expected: "2026-11-10T01:00:00Z",
    },
    {
      label: "LA 서머타임 시작일의 없는 02:30은 전환 뒤 03:30 PDT",
      date: "2026-03-08",
      time: "02:30",
      timeZone: LOS_ANGELES,
      expected: "2026-03-08T10:30:00Z",
    },
    {
      label: "LA 서머타임 종료일의 겹치는 01:30은 앞쪽 PDT",
      date: "2026-11-01",
      time: "01:30",
      timeZone: LOS_ANGELES,
      expected: "2026-11-01T08:30:00Z",
    },
  ])("$label", ({ date, time, timeZone, expected }) => {
    // Given
    const params = {
      date: Temporal.PlainDate.from(date),
      time: Temporal.PlainTime.from(time),
      timeZone,
    };

    // When
    const instant = toZonedInstant(params);

    // Then
    expect(instant.equals(Temporal.Instant.from(expected))).toBe(true);
  });
});

describe("localDateOf — 순간의 현지 날짜", () => {
  it.each([
    {
      label: "서울 자정 직전",
      instant: "2026-11-09T14:59:59.999Z",
      timeZone: TimeZone.SEOUL,
      expected: "2026-11-09",
    },
    {
      label: "서울 자정",
      instant: "2026-11-09T15:00:00Z",
      timeZone: TimeZone.SEOUL,
      expected: "2026-11-10",
    },
    {
      label: "LA 자정 직전",
      instant: "2026-11-10T07:59:59.999Z",
      timeZone: LOS_ANGELES,
      expected: "2026-11-09",
    },
    {
      label: "LA 자정",
      instant: "2026-11-10T08:00:00Z",
      timeZone: LOS_ANGELES,
      expected: "2026-11-10",
    },
  ])("$label", ({ instant, timeZone, expected }) => {
    // Given
    const moment = Temporal.Instant.from(instant);

    // When
    const date = localDateOf(moment, timeZone);

    // Then
    expect(date.toString()).toBe(expected);
  });
});
