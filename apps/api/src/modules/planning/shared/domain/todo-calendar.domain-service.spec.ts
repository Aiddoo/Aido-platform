import { toIsoString } from "#api/shared/domain/time/instant";

import {
  addDaysToKey,
  localDateKeyAt,
  localTimeIn,
  resolveScheduledInstant,
} from "./todo-calendar.domain-service.js";

const SEOUL = "Asia/Seoul";
const LOS_ANGELES = "America/Los_Angeles";

describe("resolveScheduledInstant — 떠 있는 벽시계를 순간으로", () => {
  it.each([
    {
      label: "서울 자정",
      date: "2026-11-10",
      time: "00:00",
      zone: SEOUL,
      expected: "2026-11-09T15:00:00.000Z",
    },
    {
      label: "서울 자정 직전",
      date: "2026-11-10",
      time: "23:59",
      zone: SEOUL,
      expected: "2026-11-10T14:59:00.000Z",
    },
    {
      label: "LA 자정(PST)",
      date: "2026-11-10",
      time: "00:00",
      zone: LOS_ANGELES,
      expected: "2026-11-10T08:00:00.000Z",
    },
    {
      label: "LA 서머타임 시작일의 없는 02:30은 전환 뒤 03:30 PDT",
      date: "2026-03-08",
      time: "02:30",
      zone: LOS_ANGELES,
      expected: "2026-03-08T10:30:00.000Z",
    },
    {
      label: "LA 서머타임 시작 직전 01:59 PST",
      date: "2026-03-08",
      time: "01:59",
      zone: LOS_ANGELES,
      expected: "2026-03-08T09:59:00.000Z",
    },
    {
      label: "LA 서머타임 종료일의 겹치는 01:30은 앞쪽 PDT",
      date: "2026-11-01",
      time: "01:30",
      zone: LOS_ANGELES,
      expected: "2026-11-01T08:30:00.000Z",
    },
    {
      label: "LA 서머타임 종료 뒤 02:00 PST",
      date: "2026-11-01",
      time: "02:00",
      zone: LOS_ANGELES,
      expected: "2026-11-01T10:00:00.000Z",
    },
    {
      label: "윤일 서울 09:00",
      date: "2028-02-29",
      time: "09:00",
      zone: SEOUL,
      expected: "2028-02-29T00:00:00.000Z",
    },
    {
      label: "알 수 없는 시간대는 UTC로 계산한다",
      date: "2026-11-10",
      time: "09:00",
      zone: "Mars/Base",
      expected: "2026-11-10T09:00:00.000Z",
    },
  ])("$label", ({ date, time, zone, expected }) => {
    // When
    const instant = resolveScheduledInstant(date, time, zone);

    // Then
    expect(instant == null ? null : toIsoString(instant)).toBe(expected);
  });

  it("벽시계가 없으면 순간도 없다(종일)", () => {
    // When
    const instant = resolveScheduledInstant("2026-11-10", null, SEOUL);

    // Then
    expect(instant).toBeNull();
  });
});

describe("localDateKeyAt·localTimeIn — 순간의 현지 달력·벽시계", () => {
  it.each([
    {
      label: "서울 자정 직전",
      at: "2026-11-09T14:59:59.999Z",
      zone: SEOUL,
      date: "2026-11-09",
      time: "23:59",
    },
    {
      label: "서울 자정",
      at: "2026-11-09T15:00:00.000Z",
      zone: SEOUL,
      date: "2026-11-10",
      time: "00:00",
    },
    {
      label: "LA 자정 직전",
      at: "2026-11-10T07:59:59.999Z",
      zone: LOS_ANGELES,
      date: "2026-11-09",
      time: "23:59",
    },
    {
      label: "LA 자정",
      at: "2026-11-10T08:00:00.000Z",
      zone: LOS_ANGELES,
      date: "2026-11-10",
      time: "00:00",
    },
    {
      label: "LA 겹치는 첫 01:30(PDT)",
      at: "2026-11-01T08:30:00.000Z",
      zone: LOS_ANGELES,
      date: "2026-11-01",
      time: "01:30",
    },
    {
      label: "LA 겹치는 둘째 01:30(PST)",
      at: "2026-11-01T09:30:00.000Z",
      zone: LOS_ANGELES,
      date: "2026-11-01",
      time: "01:30",
    },
  ])("$label", ({ at, zone, date, time }) => {
    // Given
    const moment = Temporal.Instant.from(at);

    // When
    const result = { date: localDateKeyAt(moment, zone), time: localTimeIn(moment, zone) };

    // Then
    expect(result).toEqual({ date, time });
  });
});

describe("날짜 키 — DATE 칸 경계", () => {
  it.each([
    { from: "2028-02-28", days: 1, expected: "2028-02-29" },
    { from: "2027-02-28", days: 1, expected: "2027-03-01" },
    { from: "2026-12-31", days: 1, expected: "2027-01-01" },
    { from: "2026-03-31", days: -31, expected: "2026-02-28" },
  ])("$from + $days일 = $expected", ({ from, days, expected }) => {
    // When
    const key = addDaysToKey(from, days);

    // Then
    expect(key).toBe(expected);
  });
});
