import type { AggregatedReportData } from "../../../domain/types/reports/ai-report.types.js";
import { buildFallbackContent, buildNoActivityContent } from "./report-fallback.js";

const activeData: AggregatedReportData = {
  totalTodos: 20,
  completedTodos: 15,
  completionRate: 75,
  prevCompletionRate: 60,
  streakDays: 4,
  categoryBreakdown: [],
  dayPatterns: [],
  timePatterns: [],
  hasActivity: true,
};

describe("report fallback content", () => {
  it.each([
    {
      locale: "ko" as const,
      label: "2026년 43주차",
      summary:
        "2026년 43주차에는 등록된 할 일이 없었어요. 기록이 생기면 다음 리포트에서 흐름을 함께 볼 수 있어요.",
      tip: "다음 기간에 해보고 싶은 작은 일 하나를 앱에 등록해보세요.",
    },
    {
      locale: "en" as const,
      label: "Week 43, 2026",
      summary:
        "No to-dos were recorded in Week 43, 2026. Once you add some, the next report can show how things went.",
      tip: "Add one small thing you'd like to do next period to the app.",
    },
  ])(
    "$locale 활동 없음 템플릿은 기간 라벨만 쓰고 출처를 TEMPLATE로 남긴다",
    ({ locale, label, summary, tip }) => {
      // Given / When
      const result = buildNoActivityContent(label, locale);
      // Then
      expect(result).toEqual({
        aiSummary: summary,
        aiTips: [tip],
        contentSource: "TEMPLATE",
        promptVersion: null,
      });
    },
  );

  it("활동 있는 폴백은 서버 통계로 요약하고 언어별 팁 개수가 같다", () => {
    // Given / When
    const ko = buildFallbackContent(activeData, "2026년 43주차", "ko");
    const en = buildFallbackContent(activeData, "Week 43, 2026", "en");
    // Then
    expect(ko.aiSummary).toBe("2026년 43주차에는 할 일 20개 중 15개를 완료해 달성률 75%였어요.");
    expect(en.aiSummary).toBe(
      "In Week 43, 2026 you completed 15 of 20 to-dos, a 75% completion rate.",
    );
    expect(ko.aiTips).toHaveLength(1);
    expect(en.aiTips).toHaveLength(ko.aiTips.length);
    expect(ko.contentSource).toBe("FALLBACK");
    expect(ko.aiTips[0]).not.toMatch(/꾸준히|루틴을 만들어/);
  });

  it("활동 없는 기간의 폴백도 FALLBACK 출처로 남긴다", () => {
    // Given / When
    const result = buildFallbackContent({ ...activeData, hasActivity: false }, "2026년 10월", "ko");
    // Then
    expect(result.contentSource).toBe("FALLBACK");
    expect(result.aiSummary).toContain("2026년 10월에는 등록된 할 일이 없었어요");
  });
});
