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
import { FakeAiProvider } from "#test/mocks/fake-ai.provider";
import {
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
    unitOfWork,
    contextBuilder,
    logger,
    entitlementReader: access,
    userMutationLock: access,
  });
  const generateReport = new GenerateReport({
    aiReportRepository: reportRepository,
    todoStatsReader,
    aiProvider,
    logger,
    entitlementReader: access,
    unitOfWork,
    userMutationLock: access,
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
    logger,
    contextBuilder,
    analyze,
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

export function useReportResponse(
  fixture: ReturnType<typeof createAiAssistanceFixture>,
  locale: "ko" | "en" = "ko",
) {
  fixture.aiProvider.setRawResponse(createReportAiResponse(locale));
  return fixture;
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
