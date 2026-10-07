import type { TodoAggregateByDate } from "../../records/daily-completions/daily-completion.record.js";
import { buildDailyCompletionsRange, toSummaries } from "./daily-completion.policy.js";

function aggregate(overrides: Partial<TodoAggregateByDate> & { date: Date }): TodoAggregateByDate {
  return {
    total: 0,
    completed: 0,
    categoryColors: [],
    ...overrides,
  };
}

describe("daily-completion 도메인", () => {
  describe("toSummaries", () => {
    it("완료일(isComplete)과 완료율을 규칙대로 계산한다", () => {
      const summaries = toSummaries([
        aggregate({
          date: new Date("2026-01-15"),
          total: 3,
          completed: 3,
          categoryColors: ["#FF6B43"],
        }),
        aggregate({
          date: new Date("2026-01-16"),
          total: 4,
          completed: 2,
        }),
      ]);

      expect(summaries[0]).toMatchObject({
        date: "2026-01-15",
        isComplete: true,
        completionRate: 100,
      });
      expect(summaries[1]).toMatchObject({
        date: "2026-01-16",
        isComplete: false,
        completionRate: 50,
      });
    });

    it("할 일이 0개면 완료일이 아니고 완료율은 0이다", () => {
      const [summary] = toSummaries([
        aggregate({ date: new Date("2026-01-15"), total: 0, completed: 0 }),
      ]);
      expect(summary).toMatchObject({ isComplete: false, completionRate: 0 });
    });

    it("결과를 날짜 오름차순으로 정렬한다", () => {
      const summaries = toSummaries([
        aggregate({ date: new Date("2026-01-20"), total: 1, completed: 1 }),
        aggregate({ date: new Date("2026-01-10"), total: 1, completed: 0 }),
      ]);
      expect(summaries.map((s) => s.date)).toEqual(["2026-01-10", "2026-01-20"]);
    });
  });

  describe("buildDailyCompletionsRange", () => {
    it("완료일 수를 isComplete 개수로 집계하고 범위를 보존한다", () => {
      const range = buildDailyCompletionsRange(
        [
          aggregate({ date: new Date("2026-01-15"), total: 2, completed: 2 }),
          aggregate({ date: new Date("2026-01-16"), total: 2, completed: 1 }),
        ],
        { startDate: "2026-01-01", endDate: "2026-01-31" },
      );

      expect(range.totalCompleteDays).toBe(1);
      expect(range.completions).toHaveLength(2);
      expect(range.dateRange).toEqual({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });
    });
  });

  it("입력의 색상 배열과 조회 범위가 변경되어도 계산 결과를 유지한다", () => {
    // Given
    const categoryColors = ["#123456"];
    const dateRange = { startDate: "2028-02-29", endDate: "2028-02-29" };
    const range = buildDailyCompletionsRange(
      [
        aggregate({
          date: new Date("2028-02-29T00:00:00Z"),
          total: 1,
          completed: 1,
          categoryColors,
        }),
      ],
      dateRange,
    );
    // When
    categoryColors.push("#654321");
    dateRange.endDate = "2028-03-01";
    // Then
    expect(range.completions[0]?.categoryColors).toEqual(["#123456"]);
    expect(range.dateRange).toEqual({ startDate: "2028-02-29", endDate: "2028-02-29" });
  });
});
