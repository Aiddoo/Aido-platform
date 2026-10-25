import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  AiProvider,
  GenerateStructuredOptions,
  GenerateStructuredResult,
} from "#api/modules/ai-assistance/application/ports/parsing/ai-provider.port";
import { SuggestionContextBuilder } from "#api/modules/ai-assistance/application/services/suggestions/suggestion-context.builder";
import { GenerateReport } from "#api/modules/ai-assistance/application/use-cases/reports/generate-report.use-case";
import { AnalyzeAndCreateSuggestions } from "#api/modules/ai-assistance/application/use-cases/suggestions/analyze-and-create-suggestions.use-case";
import type { TodoSummaryForAnalysis } from "#api/modules/ai-assistance/domain/types/suggestions/ai-suggestion.types";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  TEST_AI_TASK_SETTINGS,
  TEST_AI_TASK_SETTINGS_V1,
} from "#test/fixtures/ai-task-settings.fixture";
import { FakeAiProvider } from "#test/mocks/fake-ai.provider";
import {
  StubAiDataSharingConsent,
  StubAiGenerationAccess,
  StubAiGenerationUnitOfWork,
  StubAiReportRepository,
  StubAiSuggestionRepository,
  StubAiTodoStatsReader,
  StubAiWeatherForecastReader,
  StubAiWeeklyReportReader,
} from "#test/mocks/ports/ai-assistance.stub";

import { createDetectedPattern, createReportAiResponse } from "./ai-response.fixture.js";

export const AI_ASSISTANCE_TIME = new Date("2026-03-22T12:00:00Z");

export function createAnalysisTodo(
  overrides: Partial<TodoSummaryForAnalysis> = {},
): TodoSummaryForAnalysis {
  return {
    title: "책 읽기 10분",
    startDate: "2026-03-16",
    scheduledTime: null,
    categoryId: 7,
    completed: true,
    categoryName: "독서",
    ...overrides,
  };
}

class GatedFakeAiProvider extends FakeAiProvider implements AiProvider {
  beforeResult: (() => Promise<void>) | undefined;
  override async generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const result = await super.generateStructured(options);
    await this.beforeResult?.();
    return result;
  }
}

/** 실제 응답 대기 시점의 상태 변경을 Promise barrier로 고정한다. */
export function pauseAiResponse(provider: GatedFakeAiProvider) {
  let markEntered!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  provider.beforeResult = async () => {
    markEntered();
    await pending;
  };
  return { entered, release };
}

export function createAiAssistanceFixture() {
  const userId = "ai-fixture-user";
  const unitOfWork = new StubAiGenerationUnitOfWork();
  const access = new StubAiGenerationAccess(unitOfWork);
  const repository = new StubAiSuggestionRepository();
  repository.todos = ["2026-03-02", "2026-03-09", "2026-03-16"].map((startDate) =>
    createAnalysisTodo({ startDate }),
  );
  const reportRepository = new StubAiReportRepository();
  const todoStatsReader = new StubAiTodoStatsReader();
  const weatherForecastReader = new StubAiWeatherForecastReader();
  const reportReader = new StubAiWeeklyReportReader();
  const aiProvider = new GatedFakeAiProvider();
  const aiDataSharingConsent = new StubAiDataSharingConsent();
  const logger = mock<ApplicationLogger>();
  const contextBuilder = new SuggestionContextBuilder({
    repository,
    weatherForecastReader,
    reportReader,
    logger,
  });
  const analyze = new AnalyzeAndCreateSuggestions({
    repository,
    aiProvider,
    aiDataSharingConsent,
    unitOfWork,
    contextBuilder,
    logger,
    entitlementReader: access,
    userMutationLock: access,
    // 기존 제안 시나리오는 v1 응답 모양이라 v1 롤백 경로로 검증한다.
    settings: TEST_AI_TASK_SETTINGS_V1,
  });
  const analyzeV2 = new AnalyzeAndCreateSuggestions({
    repository,
    aiProvider,
    aiDataSharingConsent,
    unitOfWork,
    contextBuilder,
    logger,
    entitlementReader: access,
    userMutationLock: access,
    settings: TEST_AI_TASK_SETTINGS,
  });
  const generateReport = new GenerateReport({
    aiReportRepository: reportRepository,
    todoStatsReader,
    aiProvider,
    aiDataSharingConsent,
    logger,
    entitlementReader: access,
    unitOfWork,
    userMutationLock: access,
    settings: TEST_AI_TASK_SETTINGS,
  });
  return {
    userId,
    access,
    unitOfWork,
    repository,
    reportRepository,
    todoStatsReader,
    weatherForecastReader,
    reportReader,
    aiProvider,
    aiDataSharingConsent,
    logger,
    contextBuilder,
    analyze,
    analyzeV2,
    generateReport,
  };
}

export function usePatternResponse(
  fixture: ReturnType<typeof createAiAssistanceFixture>,
  patterns = [createDetectedPattern()],
) {
  fixture.aiProvider.setRawResponse({ patterns });
  return fixture;
}

/** 리포트 기간에 할 일 4개 중 3개 완료 기록을 넣는다. 활동이 없으면 LLM을 부르지 않는다. */
export function useReportActivity(fixture: ReturnType<typeof createAiAssistanceFixture>) {
  const startDate = new Date("2026-03-10T00:00:00Z");
  fixture.todoStatsReader.inputs = {
    ...fixture.todoStatsReader.inputs,
    dailyTotalGroups: [{ startDate, _count: { id: 4 } }],
    dailyCompletedGroups: [{ startDate, _count: { id: 3 } }],
  };
  return fixture;
}

export function useReportResponse(
  fixture: ReturnType<typeof createAiAssistanceFixture>,
  locale: "ko" | "en" = "ko",
) {
  fixture.aiProvider.setRawResponse(createReportAiResponse(locale));
  return useReportActivity(fixture);
}

export function seedPendingSuggestion(
  fixture: ReturnType<typeof createAiAssistanceFixture>,
  id = 1,
) {
  fixture.repository.rows.set(id, {
    id,
    userId: fixture.userId,
    title: "이전 제안",
    daysOfWeek: ["MON"],
    scheduledTime: null,
    confidence: 0.8,
    reason: "이전 근거",
    matchedTodos: [],
    suggestedCategoryId: 7,
    status: "PENDING",
    expiresAt: new Date("2026-04-05T12:00:00Z"),
    createdAt: new Date(AI_ASSISTANCE_TIME),
    updatedAt: new Date(AI_ASSISTANCE_TIME),
  });
}

export async function withAiAssistanceTime<T>(
  work: () => Promise<T> | T,
  date = AI_ASSISTANCE_TIME,
): Promise<T> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
  try {
    return await work();
  } finally {
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
}
