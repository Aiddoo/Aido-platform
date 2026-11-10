import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  AiGenerationRequest,
  AiGenerationResult,
  AiGeneratorPort,
} from "#api/modules/ai-assistance/generation/application/ports/ai-generator.port";
import { GenerateReport } from "#api/modules/ai-assistance/reports/application/use-cases/generate-report.use-case";
import { SuggestionContextBuilder } from "#api/modules/ai-assistance/suggestions/application/suggestion-context.reader";
import { AnalyzeAndCreateSuggestions } from "#api/modules/ai-assistance/suggestions/application/use-cases/analyze-and-create-suggestions.use-case";
import type { SuggestionPick } from "#api/modules/ai-assistance/suggestions/domain/suggestion-candidates.domain-service";
import type { TodoSummaryForAnalysis } from "#api/modules/ai-assistance/suggestions/domain/suggestion.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";
import {
  StubAiDataSharingConsent,
  StubAiClientAppVersion,
  StubAiGenerationAccess,
  StubAiGenerationUnitOfWork,
  StubAiReportRepository,
  StubAiSuggestionRepository,
  StubAiTodoStatsReader,
  StubAiWeatherForecastReader,
  StubAiWeeklyReportReader,
} from "#test/mocks/ports/ai-assistance.stub";

import { createReportAiResponse } from "./ai-response.fixture.js";

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

class GatedFakeAiGenerator extends FakeAiGenerator implements AiGeneratorPort {
  beforeResult: (() => Promise<void>) | undefined;
  override async generate<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    const result = await super.generate(request);
    await this.beforeResult?.();
    return result;
  }
}

/** 실제 응답 대기 시점의 상태 변경을 Promise barrier로 고정한다. */
export function pauseAiResponse(provider: GatedFakeAiGenerator) {
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
  const generator = new GatedFakeAiGenerator();
  const aiDataSharingConsent = new StubAiDataSharingConsent();
  const clientAppVersion = new StubAiClientAppVersion();
  const logger = mock<ApplicationLoggerPort>();
  const contextBuilder = new SuggestionContextBuilder({
    repository,
    weatherForecastReader,
    reportReader,
    logger,
  });
  const analyze = new AnalyzeAndCreateSuggestions({
    repository,
    generator,
    aiDataSharingConsent,
    clientAppVersion,
    unitOfWork,
    contextBuilder,
    logger,
    entitlementReader: access,
    userMutationLock: access,
  });
  const generateReport = new GenerateReport({
    aiReportRepository: reportRepository,
    todoStatsReader,
    generator,
    aiDataSharingConsent,
    clientAppVersion,
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
    generator,
    aiDataSharingConsent,
    clientAppVersion,
    logger,
    contextBuilder,
    analyze,
    generateReport,
  };
}

/** 모델이 고른 제안 후보. 기본 기록의 후보 a1은 "책 읽기 10분"(월요일 3회 완료)이다. */
export function createSuggestionPick(overrides: Partial<SuggestionPick> = {}): SuggestionPick {
  return {
    candidateId: "a1",
    daysOfWeek: ["MON"],
    useRecordedTime: false,
    reason: "",
    ...overrides,
  };
}

export function usePickResponse(
  fixture: ReturnType<typeof createAiAssistanceFixture>,
  picks: readonly SuggestionPick[] = [createSuggestionPick()],
) {
  fixture.generator.setRawResponse({ picks });
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
  fixture.generator.setRawResponse(createReportAiResponse(locale));
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
