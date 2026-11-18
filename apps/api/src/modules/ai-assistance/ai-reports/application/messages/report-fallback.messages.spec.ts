import type { AggregatedReportData } from "../../domain/ai-reports.constants.js";
import { buildFallbackContent, buildNoActivityContent } from "./report-fallback.messages.js";

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
      summary: "등록된 할 일이 없어 흐름은 다음 리포트에서 함께 볼 수 있어요.",
      tip: "다음 주에 해보고 싶은 작은 일 하나를 등록해보세요.",
    },
    {
      locale: "ko" as const,
      type: "MONTHLY" as const,
      summary: "등록된 할 일이 없어 흐름은 다음 리포트에서 함께 볼 수 있어요.",
      tip: "다음 달에 해보고 싶은 작은 일 하나를 등록해보세요.",
    },
    {
      locale: "en" as const,
      type: "WEEKLY" as const,
      summary: "No to-dos were recorded, so the next report can show how things go.",
      tip: "Add one small thing you'd like to do next week.",
    },
    {
      locale: "en" as const,
      type: "MONTHLY" as const,
      summary: "No to-dos were recorded, so the next report can show how things go.",
      tip: "Add one small thing you'd like to do next month.",
    },
  ])(
    "$locale $type 활동 없음 템플릿은 한 문장과 다음 주·달 팁 하나이고 출처를 TEMPLATE로 남긴다",
    ({ locale, type, summary, tip }) => {
      // When
      const result = buildNoActivityContent({ type }, locale);
      // Then
      expect(result).toEqual({
        aiSummary: summary,
        aiTips: [tip],
        contentSource: "TEMPLATE",
        promptVersion: null,
      });
    },
  );

  it("활동 있는 폴백은 통계를 되풀이하지 않고 가장 많이 완료한 카테고리로 한 문장과 팁을 쓴다", () => {
    // When
    const ko = buildFallbackContent({ reportData: activeData, type: "WEEKLY" }, "ko");
    const en = buildFallbackContent({ reportData: activeData, type: "WEEKLY" }, "en");
    // Then
    expect(ko.aiSummary).toBe("'업무' 카테고리의 할 일을 가장 많이 끝냈어요.");
    expect(en.aiSummary).toBe("You finished the most to-dos in the '업무' category.");
    expect(ko.aiTips).toEqual(["'업무' 카테고리 할 일을 다음 주에도 하나 등록해보세요."]);
    expect(en.aiTips).toEqual(["Add one '업무' to-do for next week, too."]);
    expect(ko.contentSource).toBe("FALLBACK");
    expect(`${ko.aiSummary} ${ko.aiTips[0]}`).not.toMatch(/\d|꾸준히|루틴을 만들어|기간/);
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
    const ko = buildFallbackContent({ reportData: data, type: "MONTHLY" }, "ko");
    const en = buildFallbackContent({ reportData: data, type: "MONTHLY" }, "en");
    // Then
    expect(ko).toMatchObject({
      aiSummary: "작은 일 하나부터 다시 시작하기 좋은 때예요.",
      aiTips: ["다음 달에 끝내고 싶은 할 일 하나를 미리 등록해보세요."],
    });
    expect(en).toMatchObject({
      aiSummary: "It's a good time to restart with one small thing.",
      aiTips: ["Add one to-do you'd like to finish next month ahead of time."],
    });
  });

  it("활동 없는 기간의 폴백도 FALLBACK 출처로 남긴다", () => {
    // When
    const result = buildFallbackContent(
      { reportData: { ...activeData, hasActivity: false }, type: "MONTHLY" },
      "ko",
    );
    // Then
    expect(result.contentSource).toBe("FALLBACK");
    expect(result.aiSummary).toContain("등록된 할 일이 없어");
  });
});
