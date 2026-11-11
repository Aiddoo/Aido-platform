import {
  AiReport,
  type AiReportPrimitives,
} from "#api/modules/ai-assistance/reports/domain/ai-report.aggregate";

export const AI_REPORT_FIXTURE_NOW = Temporal.Instant.from("2026-03-09T07:00:00Z");
export const AI_REPORT_FIXTURE_USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";
export const AI_REPORT_FIXTURE_OTHER_USER_ID = "clz7x5p8k0002qz0z8z8z8z8z";

export function createAiReportFixture(overrides: Partial<AiReportPrimitives> = {}): AiReport {
  return AiReport.reconstitute({
    id: 1,
    userId: AI_REPORT_FIXTURE_USER_ID,
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
    aiSummary: "좋은 한 주였어요.",
    aiTips: ["아침에 가장 중요한 일을 먼저 해 보세요."],
    locale: "ko",
    hasActivity: true,
    generatedAt: AI_REPORT_FIXTURE_NOW,
    contentSource: "AI",
    promptVersion: "report@1",
    ...overrides,
  });
}
