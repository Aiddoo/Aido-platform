import { PgBoss } from "pg-boss";

import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import {
  type DueRuns,
  findDueRuns,
  judgeScheduleRuns,
  type ScheduleOccurrencePreview,
  type ScheduleRunCounts,
  scheduleRunWindowStart,
} from "./schedule-watchdog.domain-service.js";

// previewSchedule은 DB 없이 cron만 계산하므로 시작하지 않은 인스턴스로 스케줄러와 같은 해석을 쓴다
const boss = new PgBoss({ connectionString: "postgres://unused@127.0.0.1:1/unused" });

function previewOf(cron: string, timezone: string): ScheduleOccurrencePreview {
  return async (after, count) =>
    boss
      .previewSchedule(cron, { tz: timezone, from: instantToDate(after), count })
      .map(instantFromDate);
}

function instant(iso: string): Temporal.Instant {
  return Temporal.Instant.from(iso);
}

const DAY_SECONDS = 24 * 60 * 60;
const NO_RUNS: ScheduleRunCounts = { completed: 0, failed: 0, oldestPendingCreatedAt: null };

describe("findDueRuns — 끝났어야 할 최근 예정 시각 두 개", () => {
  it.each([
    {
      name: "매시 정각(UTC)",
      cron: "0 * * * *",
      timezone: "UTC",
      now: "2026-11-10T10:40:00Z",
      previous: "2026-11-10T09:00:00Z",
      latest: "2026-11-10T10:00:00Z",
    },
    {
      name: "매일 03:10(서울)",
      cron: "10 3 * * *",
      timezone: "Asia/Seoul",
      now: "2026-11-10T00:00:00Z",
      previous: "2026-11-08T18:10:00Z",
      latest: "2026-11-09T18:10:00Z",
    },
    {
      name: "매주 월요일 00:00(UTC)",
      cron: "0 0 * * 1",
      timezone: "UTC",
      now: "2026-11-11T12:00:00Z",
      previous: "2026-11-02T00:00:00Z",
      latest: "2026-11-09T00:00:00Z",
    },
    {
      name: "서머타임이 시작된 날의 매일 09:00(뉴욕, 23시간 간격)",
      cron: "0 9 * * *",
      timezone: "America/New_York",
      now: "2026-03-08T14:00:00Z",
      previous: "2026-03-07T14:00:00Z",
      latest: "2026-03-08T13:00:00Z",
    },
    {
      name: "평일 09:00의 주말 뒤 월요일",
      cron: "0 9 * * 1-5",
      timezone: "UTC",
      now: "2026-11-09T12:00:00Z",
      previous: "2026-11-06T09:00:00Z",
      latest: "2026-11-09T09:00:00Z",
    },
  ])(
    "$name 스케줄은 실제 예정 시각으로 찾는다",
    async ({ cron, timezone, now, previous, latest }) => {
      // Given
      const preview = previewOf(cron, timezone);

      // When
      const due = await findDueRuns({ now: instant(now), preview });

      // Then
      expect(due).toEqual({ previous: instant(previous), latest: instant(latest) });
    },
  );

  it("방금 지난 예정 시각은 여유 시간(30분)이 지나기 전까지 끝났어야 할 실행으로 보지 않는다", async () => {
    // Given
    const preview = previewOf("0 * * * *", "UTC");

    // When
    const due = await findDueRuns({ now: instant("2026-11-10T10:29:00Z"), preview });

    // Then
    expect(due?.latest).toEqual(instant("2026-11-10T09:00:00Z"));
  });
});

describe("scheduleRunWindowStart — 판정할 수 있는 창", () => {
  const due: DueRuns = {
    previous: instant("2026-11-10T09:00:00Z"),
    latest: instant("2026-11-10T10:00:00Z"),
  };

  it("앞 예정 시각부터(시계 차이 1분 포함) 실행을 센다", () => {
    // When
    const since = scheduleRunWindowStart({
      now: instant("2026-11-10T10:40:00Z"),
      due,
      registeredAt: instant("2026-11-01T00:00:00Z"),
      finishedRunRetentionSeconds: DAY_SECONDS,
    });

    // Then
    expect(since).toEqual(instant("2026-11-10T08:59:00Z"));
  });

  it("앞 예정 시각 뒤에 등록된 스케줄은 아직 판정하지 않는다", () => {
    // When
    const since = scheduleRunWindowStart({
      now: instant("2026-11-10T10:40:00Z"),
      due,
      registeredAt: instant("2026-11-10T09:30:00Z"),
      finishedRunRetentionSeconds: DAY_SECONDS,
    });

    // Then
    expect(since).toBeNull();
  });

  it("최근 예정 실행이 보관 기간이 지나 지워졌을 수 있으면 판정하지 않는다", () => {
    // Given
    const weekly: DueRuns = {
      previous: instant("2026-11-02T00:00:00Z"),
      latest: instant("2026-11-09T00:00:00Z"),
    };

    // When
    const since = scheduleRunWindowStart({
      now: instant("2026-11-11T12:00:00Z"),
      due: weekly,
      registeredAt: instant("2026-10-01T00:00:00Z"),
      finishedRunRetentionSeconds: DAY_SECONDS,
    });

    // Then
    expect(since).toBeNull();
  });
});

describe("judgeScheduleRuns — 창 안 실행으로 스케줄 판정", () => {
  const now = instant("2026-11-10T10:40:00Z");

  it.each([
    {
      name: "끝난 실행이 하나라도 있으면 정상이다",
      runs: { ...NO_RUNS, completed: 1, failed: 3 },
      verdict: "healthy",
    },
    {
      name: "실행은 있었는데 모두 실패했으면 failing이다",
      runs: { ...NO_RUNS, failed: 2 },
      verdict: "failing",
    },
    {
      name: "여유 시간 안에 만들어진 실행만 남아 있으면 진행 중이다",
      runs: { ...NO_RUNS, oldestPendingCreatedAt: instant("2026-11-10T10:15:00Z") },
      verdict: "in-progress",
    },
    {
      name: "여유 시간을 넘겨 멈춘 실행만 있으면 overdue다",
      runs: { ...NO_RUNS, oldestPendingCreatedAt: instant("2026-11-10T09:00:30Z") },
      verdict: "overdue",
    },
    { name: "실행이 하나도 없으면 overdue다", runs: NO_RUNS, verdict: "overdue" },
  ])("$name", ({ runs, verdict }) => {
    // When
    const result = judgeScheduleRuns({ now, runs });

    // Then
    expect(result).toBe(verdict);
  });
});
