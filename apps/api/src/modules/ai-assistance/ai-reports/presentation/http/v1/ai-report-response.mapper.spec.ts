import { AiReport, type AiReportPrimitives } from "../../../domain/ai-report.aggregate.js";
import { toAiReportResponse } from "./ai-report-response.mapper.js";

function makeProps(overrides?: Partial<AiReportPrimitives>): AiReportPrimitives {
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
    generatedAt: Temporal.Instant.from("2026-03-09T07:00:00.000Z"),
    contentSource: "AI",
    promptVersion: "report@1",
    dailyCompletions: null,
    ...overrides,
  };
}

const LOCAL_TODAY = Temporal.PlainDate.from("2026-11-12");

describe("toAiReportResponse", () => {
  it("애그리게잇을 올바른 DTO 형식으로 직렬화해야 한다", () => {
    // Given
    const report = AiReport.reconstitute(makeProps());

    // When
    const result = toAiReportResponse(report, LOCAL_TODAY);

    // Then
    expect(result.id).toBe(42);
    expect(result.type).toBe("WEEKLY");
    expect(result.year).toBe(2026);
    expect(result.period).toBe(10);
    expect(result.periodLabel).toBe("3월 1주차");
    expect(result.dateRange.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.dateRange.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.stats).toEqual({
      totalTodos: 10,
      completedTodos: 8,
      completionRate: 80,
      prevCompletionRate: 70,
      streakDays: 3,
      perfectDays: null,
    });
    expect(result.peakHour).toBe(10);
    expect(result.categoryBreakdown).toHaveLength(1);
    expect(result.dayPatterns).toHaveLength(1);
    expect(result.timePatterns).toHaveLength(1);
    expect(result.aiSummary).toBe("좋은 한 주였어!");
    expect(result.aiTips).toEqual(["계속 이렇게 해봐!"]);
    expect(result.hasActivity).toBe(true);
    expect(result.generatedAt).toBe("2026-03-09T07:00:00.000Z");
  });

  it("저장된 날짜별 값으로 완벽한 날을 세고 같은 수 시간대는 이른 시간을 주로 끝낸 시간으로 준다", () => {
    // Given
    const report = AiReport.reconstitute(
      makeProps({
        timePatterns: [
          { hour: 21, count: 3 },
          { hour: 8, count: 3 },
        ],
        dailyCompletions: [
          { date: Temporal.PlainDate.from("2026-03-02"), total: 2, completed: 2 },
          { date: Temporal.PlainDate.from("2026-03-03"), total: 0, completed: 0 },
          { date: Temporal.PlainDate.from("2026-03-04"), total: 3, completed: 1 },
        ],
      }),
    );

    // When
    const result = toAiReportResponse(report, LOCAL_TODAY);

    // Then
    expect(result.stats.perfectDays).toBe(1);
    expect(result.peakHour).toBe(8);
    expect(result.timePatterns.map(({ hour }) => hour)).toEqual([8, 21]);
  });

  it("MONTHLY 타입의 periodLabel을 올바르게 생성해야 한다", () => {
    // Given
    const report = AiReport.reconstitute(makeProps({ type: "MONTHLY", year: 2026, period: 3 }));

    // When
    const result = toAiReportResponse(report, LOCAL_TODAY);

    // Then
    expect(result.periodLabel).toBe("2026년 3월");
  });

  it("en 로케일이면 영어 periodLabel을 생성해야 한다", () => {
    // Given
    const report = AiReport.reconstitute(
      makeProps({ type: "MONTHLY", year: 2026, period: 3, locale: "en" }),
    );

    // When
    const result = toAiReportResponse(report, LOCAL_TODAY);

    // Then
    expect(result.periodLabel).toBe("March 2026");
  });

  it.each([
    ["AI", "AI"],
    ["FALLBACK", "TEMPLATE"],
    ["TEMPLATE", "TEMPLATE"],
    ["NO_AI_CONSENT", "TEMPLATE"],
    [null, "TEMPLATE"],
  ] as const)("저장된 출처 %s는 응답에서 %s이다", (contentSource, expected) => {
    // Given
    const report = AiReport.reconstitute(makeProps({ contentSource }));

    // When
    const result = toAiReportResponse(report, LOCAL_TODAY);

    // Then
    expect(result.aiContentSource).toBe(expected);
  });
});
