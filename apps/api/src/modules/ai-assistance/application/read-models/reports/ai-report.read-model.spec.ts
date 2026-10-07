import type { AiReportProps } from "../../../domain/entities/reports/ai-report.entity.js";
/**
 * AiReport 애그리게잇 단위 테스트
 *
 * - Application mapper의 응답 DTO 직렬화 검증
 *   (periodLabel·dateRange 파생 포함)
 */
import { AiReport } from "../../../domain/entities/reports/ai-report.entity.js";
import { toAiReportView } from "./ai-report.read-model.js";

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

describe("toAiReportView", () => {
  it("애그리게잇을 올바른 DTO 형식으로 직렬화해야 한다", () => {
    // Given - 저장된 리포트 snapshot
    const report = AiReport.reconstitute(makeProps());

    // When - Application read model 변환
    const result = toAiReportView(report);

    // Then - 기존 기간·통계·본문·UTC 날짜 계약 보존
    expect(result.id).toBe(42);
    expect(result.type).toBe("WEEKLY");
    expect(result.year).toBe(2026);
    expect(result.period).toBe(10);
    expect(result.periodLabel).toBe("2026년 10주차");
    expect(result.dateRange.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.dateRange.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.stats).toEqual({
      totalTodos: 10,
      completedTodos: 8,
      completionRate: 80,
      prevCompletionRate: 70,
      streakDays: 3,
    });
    expect(result.categoryBreakdown).toHaveLength(1);
    expect(result.dayPatterns).toHaveLength(1);
    expect(result.timePatterns).toHaveLength(1);
    expect(result.aiSummary).toBe("좋은 한 주였어!");
    expect(result.aiTips).toEqual(["계속 이렇게 해봐!"]);
    expect(result.hasActivity).toBe(true);
    expect(result.generatedAt).toBe("2026-03-09T07:00:00.000Z");
  });

  it("MONTHLY 타입의 periodLabel을 올바르게 생성해야 한다", () => {
    // Given - 월간 한국어 리포트
    const report = AiReport.reconstitute(makeProps({ type: "MONTHLY", year: 2026, period: 3 }));

    // When - Application mapper 실행
    const result = toAiReportView(report);

    // Then - 기존 달력 라벨 유지
    expect(result.periodLabel).toBe("2026년 3월");
  });

  it("en 로케일이면 영어 periodLabel을 생성해야 한다", () => {
    // Given - 저장된 en locale
    const report = AiReport.reconstitute(
      makeProps({ type: "MONTHLY", year: 2026, period: 3, locale: "en" }),
    );

    // When - Application mapper 실행
    const result = toAiReportView(report);

    // Then - 영어 기간 라벨 유지
    expect(result.periodLabel).toBe("March 2026");
  });
});
