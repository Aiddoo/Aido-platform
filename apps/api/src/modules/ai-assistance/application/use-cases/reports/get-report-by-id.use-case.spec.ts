import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { AiReport } from "../../../domain/entities/reports/ai-report.entity.js";
import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";
import { GetReportById } from "./get-report-by-id.use-case.js";

const makeReport = (id: number): AiReport =>
  AiReport.reconstitute({
    id,
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
    categoryBreakdown: [],
    dayPatterns: [],
    timePatterns: [],
    aiSummary: "요약",
    aiTips: [],
    locale: "ko",
    hasActivity: true,
    generatedAt: new Date("2026-03-09T07:00:00.000Z"),
  });

describe("GetReportById", () => {
  let useCase: GetReportById;
  let mockRepository: Mocked<AiReportRepositoryPort>;
  let mockEntitlement: Mocked<EntitlementService>;

  beforeEach(async () => {
    const getReportByIdDependencies = mockDeep<ConstructorParameters<typeof GetReportById>[0]>({});
    const unit = new GetReportById(getReportByIdDependencies);
    useCase = unit;
    mockRepository = getReportByIdDependencies.aiReportRepository;
    mockEntitlement = getReportByIdDependencies.entitlementService;
    mockEntitlement.hasPremiumAccess.mockResolvedValue(true);
  });

  it("비프리미엄이면 조회 없이 예외를 전파해야 한다", async () => {
    mockEntitlement.hasPremiumAccess.mockResolvedValue(false);

    await expect(useCase.execute("user-123", 1)).rejects.toBeInstanceOf(ApplicationException);
    expect(mockRepository.findByIdAndUserId).not.toHaveBeenCalled();
  });

  it("존재하는 리포트를 DTO로 반환해야 한다", async () => {
    mockRepository.findByIdAndUserId.mockResolvedValue(makeReport(42));

    const result = await useCase.execute("user-123", 42);

    expect(result.id).toBe(42);
    expect(mockRepository.findByIdAndUserId).toHaveBeenCalledWith(42, "user-123");
  });

  it("존재하지 않으면 AI_1304를 던져야 한다", async () => {
    mockRepository.findByIdAndUserId.mockResolvedValue(null);

    await expect(useCase.execute("user-123", 999)).rejects.toMatchObject({
      errorCode: "AI_1304",
    });
  });
});
