import type { AggregatedReportData } from "../../../domain/types/reports/ai-report.types.js";
import { buildFallbackContent, buildNoActivityContent } from "./report-fallback.js";

const activeData: AggregatedReportData = {
  totalTodos: 20,
  completedTodos: 15,
  completionRate: 75,
  prevCompletionRate: 60,
  streakDays: 4,
  categoryBreakdown: [
    { name: "운동", color: "#000000", total: 8, completed: 4, rate: 50 },
    { name: "업무", color: "#000000", total: 12, completed: 11, rate: 92 },
  ],
  dayPatterns: [],
  timePatterns: [],
  hasActivity: true,
};

describe("report fallback content", () => {
  it.each([
    {
      locale: "ko" as const,
      type: "WEEKLY" as const,
      periodLabel: "2026년 43주차",
      summary:
        "2026년 43주차에는 등록된 할 일이 없었어요. 기록이 생기면 다음 리포트에서 흐름을 함께 볼 수 있어요.",
      tip: "다음 주에 해보고 싶은 작은 일 하나를 등록해보세요.",
    },
    {
      locale: "ko" as const,
      type: "MONTHLY" as const,
      periodLabel: "2026년 10월",
      summary:
        "2026년 10월에는 등록된 할 일이 없었어요. 기록이 생기면 다음 리포트에서 흐름을 함께 볼 수 있어요.",
      tip: "다음 달에 해보고 싶은 작은 일 하나를 등록해보세요.",
    },
    {
      locale: "en" as const,
      type: "WEEKLY" as const,
      periodLabel: "Week 43, 2026",
      summary:
        "No to-dos were recorded in Week 43, 2026. Once you add some, the next report can show how things went.",
      tip: "Add one small thing you'd like to do next week.",
    },
    {
      locale: "en" as const,
      type: "MONTHLY" as const,
      periodLabel: "October 2026",
      summary:
        "No to-dos were recorded in October 2026. Once you add some, the next report can show how things went.",
      tip: "Add one small thing you'd like to do next month.",
    },
  ])(
    "$locale $type 활동 없음 템플릿은 기간 라벨과 다음 주·달로 쓰고 출처를 TEMPLATE로 남긴다",
    ({ locale, type, periodLabel, summary, tip }) => {
      // Given / When
      const result = buildNoActivityContent({ periodLabel, type }, locale);
      // Then
      expect(result).toEqual({
        aiSummary: summary,
        aiTips: [tip],
        contentSource: "TEMPLATE",
        promptVersion: null,
      });
    },
  );

  it("활동 있는 폴백은 서버 통계로 요약하고 가장 많이 완료한 카테고리로 팁을 쓴다", () => {
    // Given / When
    const ko = buildFallbackContent(
      { data: activeData, periodLabel: "2026년 43주차", type: "WEEKLY" },
      "ko",
    );
    const en = buildFallbackContent(
      { data: activeData, periodLabel: "Week 43, 2026", type: "WEEKLY" },
      "en",
    );
    // Then
    expect(ko.aiSummary).toBe("2026년 43주차에는 할 일 20개 중 15개를 완료해 달성률 75%였어요.");
    expect(en.aiSummary).toBe(
      "In Week 43, 2026, you completed 15 of 20 to-dos, a 75% completion rate.",
    );
    expect(ko.aiTips).toEqual(["업무 할 일을 다음 주에도 하나 등록해보세요."]);
    expect(en.aiTips).toEqual(["Add one 업무 to-do for next week, too."]);
    expect(ko.contentSource).toBe("FALLBACK");
    expect(ko.aiTips[0]).not.toMatch(/꾸준히|루틴을 만들어|기간/);
  });

  it("완료한 카테고리가 없으면 카테고리 없이 다음 달 팁을 쓰고 언어별 팁 개수가 같다", () => {
    // Given
    const data = {
      ...activeData,
      completedTodos: 0,
      completionRate: 0,
      categoryBreakdown: [{ name: "운동", color: "#000000", total: 3, completed: 0, rate: 0 }],
    };
    // When
    const ko = buildFallbackContent({ data, periodLabel: "2026년 10월", type: "MONTHLY" }, "ko");
    const en = buildFallbackContent({ data, periodLabel: "October 2026", type: "MONTHLY" }, "en");
    // Then
    expect(ko.aiTips).toEqual(["다음 달에 끝내고 싶은 할 일 하나를 미리 등록해보세요."]);
    expect(en.aiTips).toEqual(["Add one to-do you'd like to finish next month ahead of time."]);
  });

  it("활동 없는 기간의 폴백도 FALLBACK 출처로 남긴다", () => {
    // Given / When
    const result = buildFallbackContent(
      { data: { ...activeData, hasActivity: false }, periodLabel: "2026년 10월", type: "MONTHLY" },
      "ko",
    );
    // Then
    expect(result.contentSource).toBe("FALLBACK");
    expect(result.aiSummary).toContain("2026년 10월에는 등록된 할 일이 없었어요");
  });
});
