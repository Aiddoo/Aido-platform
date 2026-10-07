import type { AiReportProps } from "./ai-report.entity.js";
import { AiReport } from "./ai-report.entity.js";

function makeProps(overrides?: Partial<AiReportProps>): AiReportProps {
  return {
    id: 42,
    userId: "user-123",
    type: "WEEKLY",
    year: 2026,
    period: 10,
    stats: {
      totalTodos: 10,
      completedTodos: 8,
      completionRate: 80,
      prevCompletionRate: 70,
      streakDays: 3,
    },
    categoryBreakdown: [{ name: "업무", color: "#FF0000", total: 5, completed: 4, rate: 80 }],
    dayPatterns: [{ day: "MON", total: 3, completed: 2, rate: 67 }],
    timePatterns: [{ hour: 10, count: 5 }],
    aiSummary: "좋은 한 주였어!",
    aiTips: ["계속 이렇게 해봐!"],
    locale: "ko",
    hasActivity: true,
    generatedAt: new Date("2026-03-09T07:00:00.000Z"),
    ...overrides,
  };
}

describe("AiReport immutable snapshot", () => {
  it("복원 입력 날짜가 바뀌어도 저장된 분석 시각을 유지한다", () => {
    const input = makeProps();
    const report = AiReport.reconstitute(input);
    input.generatedAt.setUTCFullYear(2030);
    expect(report.snapshot.generatedAt.toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });
  it("반환 snapshot의 날짜가 바뀌어도 다음 조회의 분석 시각을 유지한다", () => {
    const report = AiReport.reconstitute(makeProps());
    report.snapshot.generatedAt.setUTCFullYear(2030);
    expect(report.snapshot.generatedAt.toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });
  it("입력 stats/배열을 복사해 외부 상태 변경으로 결과가 바뀌지 않는다", () => {
    const stats = {
      totalTodos: 10,
      completedTodos: 8,
      completionRate: 80,
      prevCompletionRate: 70,
      streakDays: 3,
    };
    const category = { name: "업무", color: "#FF0000", total: 5, completed: 4, rate: 80 };
    const tips = ["기존 팁"];
    const report = AiReport.reconstitute(
      makeProps({ stats, categoryBreakdown: [category], aiTips: tips }),
    );
    stats.totalTodos = 999;
    category.name = "외부 변경";
    tips.push("외부 팁");
    expect(report.stats.totalTodos).toBe(10);
    expect(report.snapshot.categoryBreakdown[0]?.name).toBe("업무");
    expect(report.aiTips).toEqual(["기존 팁"]);
    expect(report.snapshot.stats).not.toBe(report.snapshot.stats);
    expect(report.snapshot.categoryBreakdown[0]).not.toBe(report.snapshot.categoryBreakdown[0]);
  });
});
