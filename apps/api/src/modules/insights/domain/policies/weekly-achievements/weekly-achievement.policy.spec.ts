import type {
  WeeklyAchievementRecord,
  WeeklyAchievementRow,
  WeeklyAchievementUpsert,
} from "../../records/weekly-achievements/weekly-achievement.record.js";
import {
  buildWeeklyAchievementSnapshot,
  computeDateRange,
  computeStreak,
  computeSummary,
} from "./weekly-achievement.policy.js";

function row(overrides?: Partial<WeeklyAchievementRow>): WeeklyAchievementRow {
  return {
    id: 1,
    year: 2026,
    week: 1,
    totalTodos: 10,
    completedTodos: 8,
    achievedAt: new Date("2026-01-05T11:00:00.000Z"),
    ...overrides,
  };
}

describe("weekly-achievement 도메인", () => {
  describe("computeDateRange", () => {
    it("월요일~일요일 범위를 반환한다", () => {
      const range = computeDateRange(2026, 10);
      expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(6);
    });

    it("2026년 10주차의 정확한 날짜를 반환한다", () => {
      const range = computeDateRange(2026, 10);
      expect(range.startDate).toBe("2026-03-02");
      expect(range.endDate).toBe("2026-03-08");
    });
  });

  describe("computeStreak", () => {
    it("빈 배열이면 0을 반환한다", () => {
      expect(computeStreak([])).toEqual({ currentStreak: 0, bestStreak: 0 });
    });

    it("단일 레코드면 streak은 1이다", () => {
      expect(computeStreak([{ year: 2026, week: 5 }])).toEqual({
        currentStreak: 1,
        bestStreak: 1,
      });
    });

    it("연속 주차의 streak을 계산한다", () => {
      const records: WeeklyAchievementRecord[] = [
        { year: 2026, week: 5 },
        { year: 2026, week: 6 },
        { year: 2026, week: 7 },
      ];
      expect(computeStreak(records)).toEqual({
        currentStreak: 3,
        bestStreak: 3,
      });
    });

    it("중간에 빈 주가 있으면 streak이 끊긴다", () => {
      const records: WeeklyAchievementRecord[] = [
        { year: 2026, week: 5 },
        { year: 2026, week: 6 },
        // week 7 missing
        { year: 2026, week: 8 },
        { year: 2026, week: 9 },
        { year: 2026, week: 10 },
      ];
      const result = computeStreak(records);
      expect(result.currentStreak).toBe(3); // 8, 9, 10
      expect(result.bestStreak).toBe(3); // 8, 9, 10
    });

    it("연말→연초 경계를 처리한다", () => {
      const records: WeeklyAchievementRecord[] = [
        { year: 2025, week: 51 },
        { year: 2025, week: 52 },
        { year: 2026, week: 1 },
        { year: 2026, week: 2 },
      ];
      const result = computeStreak(records);
      expect(result.currentStreak).toBe(4);
      expect(result.bestStreak).toBe(4);
    });

    it("bestStreak과 currentStreak이 다를 수 있다", () => {
      const records: WeeklyAchievementRecord[] = [
        { year: 2026, week: 1 },
        { year: 2026, week: 2 },
        { year: 2026, week: 3 },
        { year: 2026, week: 4 }, // bestStreak = 4
        // gap
        { year: 2026, week: 8 },
        { year: 2026, week: 9 }, // currentStreak = 2
      ];
      const result = computeStreak(records);
      expect(result.currentStreak).toBe(2);
      expect(result.bestStreak).toBe(4);
    });

    it("53주차 연도의 연말→연초 경계를 처리한다", () => {
      // 2020년은 53 ISO weeks
      const records: WeeklyAchievementRecord[] = [
        { year: 2020, week: 52 },
        { year: 2020, week: 53 },
        { year: 2021, week: 1 },
      ];
      const result = computeStreak(records);
      expect(result.currentStreak).toBe(3);
      expect(result.bestStreak).toBe(3);
    });
  });

  describe("computeSummary", () => {
    it("빈 배열이면 모든 값이 0이다", () => {
      expect(computeSummary([])).toEqual({
        totalWeeks: 0,
        perfectWeeks: 0,
        currentStreak: 0,
        bestStreak: 0,
        averageRate: 0,
      });
    });

    it("통계를 정확하게 계산한다", () => {
      const rows = [
        row({ year: 2026, week: 1, totalTodos: 10, completedTodos: 10 }), // 100%
        row({ year: 2026, week: 2, totalTodos: 10, completedTodos: 8 }), // 80%
        row({ year: 2026, week: 3, totalTodos: 10, completedTodos: 10 }), // 100%
      ];
      const summary = computeSummary(rows);
      expect(summary.totalWeeks).toBe(3);
      expect(summary.perfectWeeks).toBe(2);
      expect(summary.averageRate).toBe(93); // (100+80+100)/3 = 93.33 → 93
      expect(summary.currentStreak).toBe(3);
      expect(summary.bestStreak).toBe(3);
    });
  });

  describe("buildWeeklyAchievementSnapshot — 불변식", () => {
    function upsert(overrides?: Partial<WeeklyAchievementUpsert>): WeeklyAchievementUpsert {
      return {
        userId: "user-1",
        year: 2026,
        week: 10,
        totalTodos: 5,
        completedTodos: 3,
        achievedAt: new Date("2026-03-09T00:00:00.000Z"),
        ...overrides,
      };
    }

    it("유효한 입력은 그대로 통과시킨다", () => {
      const input = upsert();
      expect(buildWeeklyAchievementSnapshot(input)).toEqual(input);
    });

    it("완료 수가 전체 수를 초과하면 SYS_0002로 실패한다", () => {
      expect(() =>
        buildWeeklyAchievementSnapshot(upsert({ totalTodos: 2, completedTodos: 5 })),
      ).toThrow();
    });

    it("주차가 ISO 범위를 벗어나면 SYS_0002로 실패한다", () => {
      expect(() => buildWeeklyAchievementSnapshot(upsert({ week: 54 }))).toThrow();
    });
  });

  it("입력의 Date를 변경해도 검증된 주간 스냅샷은 기존 시각을 유지한다", () => {
    // Given
    const achievedAt = new Date("2028-03-06T00:00:00Z");
    const input = {
      userId: "user-1",
      year: 2028,
      week: 9,
      totalTodos: 2,
      completedTodos: 1,
      achievedAt,
    };
    const snapshot = buildWeeklyAchievementSnapshot(input);
    // When
    achievedAt.setUTCDate(7);
    // Then
    expect(snapshot.achievedAt.toISOString()).toBe("2028-03-06T00:00:00.000Z");
    expect(snapshot).not.toBe(input);
  });

  it("윤년의 주차와 연말 53주에서 다음 해 1주까지의 연속 기록을 유지한다", () => {
    // Given
    const records = [
      { year: 2026, week: 53 },
      { year: 2027, week: 1 },
    ];
    // When
    const range = computeDateRange(2028, 9);
    const streak = computeStreak(records);
    // Then
    expect(range).toEqual({ startDate: "2028-02-28", endDate: "2028-03-05" });
    expect(computeDateRange(2026, 53)).toEqual({ startDate: "2026-12-28", endDate: "2027-01-03" });
    expect(streak).toEqual({ currentStreak: 2, bestStreak: 2 });
  });
});
