import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { AiReport } from "../../../domain/entities/reports/ai-report.entity.js";
import type { ReportType } from "../../../domain/types/reports/ai-report.types.js";
import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";
import { GetReportStatus } from "./get-report-status.use-case.js";

const makeReport = (type: ReportType): AiReport =>
  AiReport.reconstitute({
    id: 1,
    userId: "user-123",
    type,
    year: 2026,
    period: 10,
    stats: {
      totalTodos: 10,
      completedTodos: 8,
      completionRate: 80,
      prevCompletionRate: 70,
      streakDays: 3,
    },
    categoryBreakdown: [],
    dayPatterns: [],
    timePatterns: [],
    aiSummary: "요약",
    aiTips: [],
    locale: "ko",
    hasActivity: true,
    generatedAt: new Date("2026-03-09T07:00:00.000Z"),
  });

describe("GetReportStatus", () => {
  let useCase: GetReportStatus;
  let mockRepository: Mocked<AiReportRepositoryPort>;
  let mockEntitlement: Mocked<
    ConstructorParameters<typeof GetReportStatus>[0]["entitlementReader"]
  >;

  const tz = "Asia/Seoul";

  beforeEach(async () => {
    const getReportStatusDependencies = mockDeep<ConstructorParameters<typeof GetReportStatus>[0]>(
      {},
    );
    const unit = new GetReportStatus(getReportStatusDependencies);
    useCase = unit;
    mockRepository = getReportStatusDependencies.aiReportRepository;
    mockEntitlement = getReportStatusDependencies.entitlementReader;
    mockEntitlement.hasPremiumAccess.mockResolvedValue(true);
    mockRepository.findLatest.mockResolvedValue(null);
  });

  it("비프리미엄이면 조회 없이 예외를 전파해야 한다", async () => {
    mockEntitlement.hasPremiumAccess.mockResolvedValue(false);

    await expect(useCase.execute("user-123", tz)).rejects.toBeInstanceOf(ApplicationException);
    expect(mockRepository.findLatest).not.toHaveBeenCalled();
  });

  it("daysUntil은 시간이 아닌 날짜(calendar day) 기준으로 계산해야 한다", async () => {
    // 일요일 23:00 KST (= 14:00 UTC) → 다음 월요일까지 D-1
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T14:00:00Z"));

    const result = await useCase.execute("user-123", tz);

    expect(result.daysUntilWeekly).toBe(1);

    vi.useRealTimers();
  });

  it("최신 리포트를 반환하고 findLatest를 2회 호출해야 한다", async () => {
    mockRepository.findLatest.mockImplementation(async (_userId: string, type: ReportType) =>
      type === "WEEKLY" ? makeReport("WEEKLY") : null,
    );

    const result = await useCase.execute("user-123", tz);

    expect(result.nextWeeklyAt).toBeDefined();
    expect(result.nextMonthlyAt).toBeDefined();
    expect(result.daysUntilWeekly).toBeGreaterThanOrEqual(0);
    expect(result.daysUntilMonthly).toBeGreaterThanOrEqual(0);
    expect(result.latestWeekly).not.toBeNull();
    expect(result.latestMonthly).toBeNull();
    expect(mockRepository.findLatest).toHaveBeenCalledTimes(2);
  });
});
