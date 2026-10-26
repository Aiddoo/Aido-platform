import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { AiReport } from "../../../domain/entities/reports/ai-report.entity.js";
import type { ReportType } from "../../../domain/types/reports/ai-report.types.js";
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
  let mockRepository: Mocked<
    ConstructorParameters<typeof GetReportStatus>[0]["aiReportRepository"]
  >;
  let mockEntitlement: Mocked<
    ConstructorParameters<typeof GetReportStatus>[0]["entitlementReader"]
  >;
  let mockPreference: Mocked<
    ConstructorParameters<typeof GetReportStatus>[0]["localePreferenceReader"]
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
    mockPreference = getReportStatusDependencies.localePreferenceReader;
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

  describe("사용자 시간대 기준 예정 시각", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("LA 일요일 저녁에는 LA 월요일 08:00을 다음 주간 리포트로 안내한다", async () => {
      // Given - LA 2026-10-25(일) 18:00, 서울은 이미 월요일 10:00
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-26T01:00:00Z") });
      // When
      const result = await useCase.execute("user-123", "America/Los_Angeles");
      // Then
      expect(result.nextWeeklyAt).toBe("2026-10-26T15:00:00.000Z");
      expect(result.daysUntilWeekly).toBe(1);
      expect(result.nextMonthlyAt).toBe("2026-11-01T16:00:00.000Z");
      expect(result.daysUntilMonthly).toBe(7);
    });

    it("서머타임이 끝난 뒤의 월요일 08:00은 PST 오프셋으로 계산한다", async () => {
      // Given - LA 2026-11-01(일) 12:00 PST
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-01T20:00:00Z") });
      // When
      const result = await useCase.execute("user-123", "America/Los_Angeles");
      // Then
      expect(result.nextWeeklyAt).toBe("2026-11-02T16:00:00.000Z");
      expect(result.nextMonthlyAt).toBe("2026-12-01T16:00:00.000Z");
    });

    it("X-Timezone이 없으면 저장된 사용자 시간대를 쓴다", async () => {
      // Given - 서울 2026-10-26(월) 07:00
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-25T22:00:00Z") });
      mockPreference.read.mockResolvedValue({ timezone: "Asia/Seoul", locale: "ko" });
      // When
      const result = await useCase.execute("user-123", undefined);
      // Then
      expect(result.nextWeeklyAt).toBe("2026-10-25T23:00:00.000Z");
      expect(result.daysUntilWeekly).toBe(0);
    });
  });
});
