import { vi } from "vitest";

import type {
  AiGenerationRequest,
  AiGenerationResult,
  AiGeneratorPort,
} from "#api/modules/ai-assistance/generation/application/ports/ai-generator.port";
import { ScheduledAiConsentReader } from "#api/modules/ai-assistance/generation/application/scheduled-ai-consent.reader";
import { GenerateReportUseCase } from "#api/modules/ai-assistance/reports/application/use-cases/generate-report.use-case";
import { SuggestionContextReader } from "#api/modules/ai-assistance/suggestions/application/suggestion-context.reader";
import { AnalyzeAndCreateSuggestionsUseCase } from "#api/modules/ai-assistance/suggestions/application/use-cases/analyze-and-create-suggestions.use-case";
import type { SuggestionPick } from "#api/modules/ai-assistance/suggestions/domain/suggestion-candidates.domain-service";
import { Suggestion } from "#api/modules/ai-assistance/suggestions/domain/suggestion.aggregate";
import type { TodoSummaryForAnalysis } from "#api/modules/ai-assistance/suggestions/domain/suggestion.constants";
import { InMemoryAiReportRepository } from "#test/doubles/ai-assistance/in-memory-ai-report.repository";
import { InMemorySuggestionRepository } from "#test/doubles/ai-assistance/in-memory-suggestion.repository";
import { createSpyApplicationLogger } from "#test/doubles/ai-assistance/spy-application-logger";
import { StubLatestReportStatsReader } from "#test/doubles/ai-assistance/stub-latest-report-stats.reader";
import { StubSuggestionActivityReader } from "#test/doubles/ai-assistance/stub-suggestion-activity.reader";
import { DateClock } from "#test/doubles/platform/date-clock";
import { FakeAiGenerator } from "#test/mocks/fake-ai.generator";
import {
  StubAiDataSharingConsent,
  StubAiClientAppVersion,
  StubAiGenerationAccess,
  StubAiGenerationUnitOfWork,
  StubAiTodoStatsReader,
  StubAiWeatherForecastReader,
} from "#test/mocks/ports/ai-assistance.stub";

import { createReportAiResponse } from "./ai-response.fixture.js";

const AI_ASSISTANCE_TIME = new Date("2026-03-22T12:00:00Z");

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
  const repository = new InMemorySuggestionRepository();
  const activityReader = new StubSuggestionActivityReader();
  activityReader.todos = ["2026-03-02", "2026-03-09", "2026-03-16"].map((startDate) =>
    createAnalysisTodo({ startDate }),
  );
  const reportRepository = new InMemoryAiReportRepository();
  const todoStatsReader = new StubAiTodoStatsReader();
  const weatherForecastReader = new StubAiWeatherForecastReader();
  const latestReportStats = new StubLatestReportStatsReader();
  const generator = new GatedFakeAiGenerator();
  const aiDataSharingConsent = new StubAiDataSharingConsent();
  const clientAppVersion = new StubAiClientAppVersion();
  const logger = createSpyApplicationLogger();
  const clock = new DateClock();
  const scheduledAiConsent = new ScheduledAiConsentReader({
    consentReader: aiDataSharingConsent,
    clientAppVersion,
    clock,
  });
  const contextBuilder = new SuggestionContextReader({
    activityReader,
    weatherForecastReader,
    latestReportStats,
    clock,
    logger,
  });
  const analyze = new AnalyzeAndCreateSuggestionsUseCase({
    repository,
    generator,
    scheduledAiConsent,
    unitOfWork,
    contextBuilder,
    clock,
    logger,
    entitlementReader: access,
    userMutationLock: access,
  });
  const generateReport = new GenerateReportUseCase({
    aiReportRepository: reportRepository,
    todoStatsReader,
    generator,
    scheduledAiConsent,
    clock,
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
    activityReader,
    reportRepository,
    todoStatsReader,
    weatherForecastReader,
    latestReportStats,
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
  fixture.repository.seed(
    Suggestion.reconstitute({
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
      expiresAt: Temporal.Instant.from("2026-04-05T12:00:00Z"),
      createdAt: Temporal.Instant.from(AI_ASSISTANCE_TIME.toISOString()),
      updatedAt: Temporal.Instant.from(AI_ASSISTANCE_TIME.toISOString()),
    }),
  );
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
