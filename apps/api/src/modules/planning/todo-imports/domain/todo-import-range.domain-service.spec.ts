import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { localDateIn } from "#api/shared/domain/time/timezone-name";

import { judgeImportRange } from "./todo-import-range.domain-service.js";

const FREE_DAYS = PLAN_CATALOG.CALENDAR_IMPORT.free;
const PREMIUM_DAYS = PLAN_CATALOG.CALENDAR_IMPORT.premium;

function judgeFrom(params: {
  readonly now: string;
  readonly timezone: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly horizonDays: number;
}) {
  return judgeImportRange({
    today: localDateIn(Temporal.Instant.from(params.now), params.timezone),
    startDate: Temporal.PlainDate.from(params.startDate),
    endDate: Temporal.PlainDate.from(params.endDate),
    horizonDays: params.horizonDays,
  }).kind;
}

describe("judgeImportRange", () => {
  it.each([
    {
      label: "무료 30일 마지막 날",
      endDate: "2026-12-23",
      horizonDays: FREE_DAYS,
      kind: "withinHorizon",
    },
    { label: "무료 31일째", endDate: "2026-12-24", horizonDays: FREE_DAYS, kind: "beyondHorizon" },
    {
      label: "프리미엄 365일 마지막 날",
      endDate: "2027-11-23",
      horizonDays: PREMIUM_DAYS,
      kind: "withinHorizon",
    },
    {
      label: "프리미엄 366일째",
      endDate: "2027-11-24",
      horizonDays: PREMIUM_DAYS,
      kind: "beyondHorizon",
    },
  ])("서울 오늘(2026-11-24)부터 $label → $kind", ({ endDate, horizonDays, kind }) => {
    // When
    const judged = judgeFrom({
      now: "2026-11-24T03:00:00Z",
      timezone: "Asia/Seoul",
      startDate: "2026-11-24",
      endDate,
      horizonDays,
    });

    // Then
    expect(judged).toBe(kind);
  });

  it.each([
    {
      label: "서울 자정 직전(23:59)",
      now: "2026-11-24T14:59:00Z",
      timezone: "Asia/Seoul",
      startDate: "2026-11-24",
      kind: "withinHorizon",
    },
    {
      label: "서울 자정 정각",
      now: "2026-11-24T15:00:00Z",
      timezone: "Asia/Seoul",
      startDate: "2026-11-24",
      kind: "startBeforeToday",
    },
    {
      label: "같은 순간 LA는 아직 전날",
      now: "2026-11-24T15:00:00Z",
      timezone: "America/Los_Angeles",
      startDate: "2026-11-24",
      kind: "withinHorizon",
    },
    {
      label: "LA 자정 정각",
      now: "2026-11-25T08:00:00Z",
      timezone: "America/Los_Angeles",
      startDate: "2026-11-24",
      kind: "startBeforeToday",
    },
  ])("$label, 오늘 시작 → $kind", ({ now, timezone, startDate, kind }) => {
    // When
    const judged = judgeFrom({
      now,
      timezone,
      startDate,
      endDate: startDate,
      horizonDays: FREE_DAYS,
    });

    // Then
    expect(judged).toBe(kind);
  });

  it.each([
    { label: "LA 서머타임 시작(3월) 자정", now: "2026-03-08T08:00:00Z", today: "2026-03-08" },
    { label: "LA 서머타임 끝(11월) 자정", now: "2026-11-01T07:00:00Z", today: "2026-11-01" },
    { label: "연말 LA 자정", now: "2027-01-01T08:00:00Z", today: "2027-01-01" },
  ])("그날부터 30일이 무료 범위다: $label", ({ now, today }) => {
    // Given
    const lastDay = Temporal.PlainDate.from(today)
      .add({ days: FREE_DAYS - 1 })
      .toString();
    const dayAfter = Temporal.PlainDate.from(today).add({ days: FREE_DAYS }).toString();
    const base = { now, timezone: "America/Los_Angeles", startDate: today, horizonDays: FREE_DAYS };

    // When
    const judged = [
      judgeFrom({ ...base, endDate: lastDay }),
      judgeFrom({ ...base, endDate: dayAfter }),
    ];

    // Then
    expect(judged).toEqual(["withinHorizon", "beyondHorizon"]);
  });

  it("마지막 날이 첫날보다 앞서면 다른 판단보다 먼저 endBeforeStart다", () => {
    // When
    const judged = judgeFrom({
      now: "2026-11-24T03:00:00Z",
      timezone: "Asia/Seoul",
      startDate: "2026-11-20",
      endDate: "2026-11-19",
      horizonDays: FREE_DAYS,
    });

    // Then
    expect(judged).toBe("endBeforeStart");
  });
});
