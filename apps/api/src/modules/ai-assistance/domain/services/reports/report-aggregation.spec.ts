import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";

import {
  computeDayPatterns,
  computeStreakDays,
  computeTimePatterns,
} from "./report-aggregation.js";

const row = (date: string, count: number) => ({
  startDate: new Date(`${date}T00:00:00.000Z`),
  _count: { id: count },
});

describe("보고서 DATE label과 실제 시각", () => {
  it("저장된 월요일 DATE는 실행 타임존과 무관하게 월요일이다", () => {
    const patterns = computeDayPatterns([row("2026-03-16", 2)], [row("2026-03-16", 1)]);
    expect(patterns.find((pattern) => pattern.day === "MON")).toEqual({
      day: "MON",
      total: 2,
      completed: 1,
      rate: 50,
    });
    expect(patterns.find((pattern) => pattern.day === "SUN")?.total).toBe(0);
  });
  it.each(["Asia/Seoul", "America/Los_Angeles", "America/New_York"])(
    "%s의 실제 기간 경계와 DATE label을 결합해 월~일 streak을 계산한다",
    (timezone) => {
      const groups = [row("2026-03-09", 1), row("2026-03-15", 1)];
      expect(
        computeStreakDays(
          groups,
          groups,
          parseLocalDateTime("2026-03-09", "00:00", timezone),
          parseLocalDateTime("2026-03-16", "00:00", timezone),
          timezone,
        ),
      ).toBe(2);
    },
  );
  it("LA 마지막 일요일 미완료 기록은 월요일 경계 전에 streak을 끊는다", () => {
    expect(
      computeStreakDays(
        [row("2026-03-09", 1), row("2026-03-15", 2)],
        [row("2026-03-09", 1), row("2026-03-15", 1)],
        parseLocalDateTime("2026-03-09", "00:00", "America/Los_Angeles"),
        parseLocalDateTime("2026-03-16", "00:00", "America/Los_Angeles"),
        "America/Los_Angeles",
      ),
    ).toBe(0);
  });
  it("완료 시각은 DATE label과 달리 실제 instant를 사용자 타임존으로 변환한다", () => {
    const todos = [
      {
        startDate: new Date("2026-03-16T00:00:00.000Z"),
        completedAt: new Date("2026-03-16T17:00:00.000Z"),
      },
      { startDate: new Date("2026-03-16T00:00:00.000Z"), completedAt: null },
    ];
    expect(computeTimePatterns(todos, "America/Los_Angeles")).toEqual([{ hour: 10, count: 1 }]);
  });
});
