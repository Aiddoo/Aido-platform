import { vi } from "vitest";

import type {
  AiGenerationRequest,
  AiTaskId,
  AiTaskOutputs,
  AiGeneratorPort,
} from "#api/modules/ai-assistance/ai-generations/application/ports/ai-generator.port";
import { CheckScheduledAiConsentUseCase } from "#api/modules/ai-assistance/ai-generations/application/use-cases/check-scheduled-ai-consent.use-case";
import type { AiGeneration } from "#api/modules/ai-assistance/ai-generations/domain/ai-generation.aggregate";
import { GenerateReportUseCase } from "#api/modules/ai-assistance/ai-reports/application/use-cases/generate-report.use-case";
import {
  type AnalyzeAndCreateSuggestionsCommand,
  AnalyzeAndCreateSuggestionsUseCase,
} from "#api/modules/ai-assistance/suggestions/application/use-cases/analyze-and-create-suggestions.use-case";
import { CountRecentSuggestionTodosUseCase } from "#api/modules/ai-assistance/suggestions/application/use-cases/count-recent-suggestion-todos.use-case";
import { DispatchSuggestionAnalysesUseCase } from "#api/modules/ai-assistance/suggestions/application/use-cases/dispatch-suggestion-analyses.use-case";
import { GetSuggestionAnalysisStateUseCase } from "#api/modules/ai-assistance/suggestions/application/use-cases/get-suggestion-analysis-state.use-case";
import { GetSuggestionContextUseCase } from "#api/modules/ai-assistance/suggestions/application/use-cases/get-suggestion-context.use-case";
import { RequestSuggestionAnalysisUseCase } from "#api/modules/ai-assistance/suggestions/application/use-cases/request-suggestion-analysis.use-case";
import { SuggestionAnalysisRun } from "#api/modules/ai-assistance/suggestions/domain/suggestion-analysis-run.entity";
import type { SuggestionPick } from "#api/modules/ai-assistance/suggestions/domain/suggestion-candidates.domain-service";
import { Suggestion } from "#api/modules/ai-assistance/suggestions/domain/suggestion.aggregate";
import type { TodoSummaryForAnalysis } from "#api/modules/ai-assistance/suggestions/domain/suggestions.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeAiGenerator } from "#test/doubles/ai-assistance/fake-ai.generator";
import { InMemoryAiReportRepository } from "#test/doubles/ai-assistance/in-memory-ai-report.repository";
import { InMemorySuggestionAnalysisRunRepository } from "#test/doubles/ai-assistance/in-memory-suggestion-analysis-run.repository";
import { InMemorySuggestionRepository } from "#test/doubles/ai-assistance/in-memory-suggestion.repository";
import { RecordingSuggestionAnalysisEnqueuer } from "#test/doubles/ai-assistance/recording-suggestion-analysis-enqueuer";
import { StubAiDataSharingConsentReader } from "#test/doubles/ai-assistance/stub-ai-data-sharing-consent.reader";
import {
  StubAiClientAppVersion,
  StubAiGenerationAccess,
  StubAiGenerationUnitOfWork,
  StubAiTodoStatsReader,
} from "#test/doubles/ai-assistance/stub-ai-generation-ports";
import { StubRepeatingTodoTitleReader } from "#test/doubles/ai-assistance/stub-repeating-todo-title.reader";
import { StubSingleTodoCountReader } from "#test/doubles/ai-assistance/stub-single-todo-count.reader";
import { StubSuggestionActivityReader } from "#test/doubles/ai-assistance/stub-suggestion-activity.reader";
import { StubUserTimezoneReader } from "#test/doubles/ai-assistance/stub-user-timezone.reader";
import { DateClock } from "#test/doubles/platform/date-clock";
import { RecordingApplicationLogger } from "#test/doubles/platform/recording-application-logger";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { createReportAiResponse } from "#test/fixtures/ai-assistance/ai-response.fixture";

const AI_ASSISTANCE_TIME = new Date("2026-03-22T12:00:00Z");
/** 고정 시각(서울 21:00)의 현지 날짜 */
export const AI_ASSISTANCE_TODAY = Temporal.PlainDate.from("2026-03-22");

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
  override async generate<TTask extends AiTaskId>(
    request: AiGenerationRequest<TTask>,
  ): Promise<AiGeneration<AiTaskOutputs[TTask]>> {
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
  const runs = new InMemorySuggestionAnalysisRunRepository();
  const mutationLock = new RecordingMutationLock();
  const enqueuer = new RecordingSuggestionAnalysisEnqueuer();
  const todoCountReader = new StubSingleTodoCountReader();
  const timezoneReader = new StubUserTimezoneReader();
  const onDemandConfig = { isEnabled: true };
  const activityReader = new StubSuggestionActivityReader();
  activityReader.todos = ["2026-03-02", "2026-03-09", "2026-03-16"].map((startDate) =>
    createAnalysisTodo({ startDate }),
  );
  const repeatingTitleReader = new StubRepeatingTodoTitleReader();
  const reportRepository = new InMemoryAiReportRepository();
  const todoStatsReader = new StubAiTodoStatsReader();
  const generator = new GatedFakeAiGenerator();
  const aiDataSharingConsent = new StubAiDataSharingConsentReader();
  const clientAppVersion = new StubAiClientAppVersion();
  const logger = new RecordingApplicationLogger();
  const clock = new DateClock();
  const scheduledAiConsent = new CheckScheduledAiConsentUseCase({
    consentReader: aiDataSharingConsent,
    clientAppVersion,
    clock,
  });
  const suggestionContext = new GetSuggestionContextUseCase({
    activityReader,
    repeatingTitleReader,
    clock,
  });
  const analyze = new AnalyzeAndCreateSuggestionsUseCase({
    repository,
    runs,
    generator,
    scheduledAiConsent,
    unitOfWork,
    mutationLock,
    suggestionContext,
    clock,
    logger,
    entitlementReader: access,
    userMutationLock: access,
  });
  const countRecentTodos = new CountRecentSuggestionTodosUseCase({
    todoCountReader,
    timezoneReader,
  });
  const analysisState = new GetSuggestionAnalysisStateUseCase({
    runs,
    countRecentTodos,
    scheduledAiConsent,
    onDemandConfig,
    clock,
  });
  const request = new RequestSuggestionAnalysisUseCase({
    entitlementReader: access,
    onDemandConfig,
    runs,
    suggestions: repository,
    enqueuer,
    analysisState,
    countRecentTodos,
    unitOfWork,
    mutationLock,
    clock,
    logger,
  });
  const dispatch = new DispatchSuggestionAnalysesUseCase({
    runs,
    enqueuer,
    unitOfWork,
    mutationLock,
    clock,
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
    runs,
    mutationLock,
    enqueuer,
    todoCountReader,
    timezoneReader,
    onDemandConfig,
    activityReader,
    repeatingTitleReader,
    reportRepository,
    todoStatsReader,
    generator,
    aiDataSharingConsent,
    clientAppVersion,
    logger,
    suggestionContext,
    analyze,
    request,
    dispatch,
    generateReport,
  };
}

export function createAnalyzeCommand(
  fixture: ReturnType<typeof createAiAssistanceFixture>,
  overrides: Partial<AnalyzeAndCreateSuggestionsCommand> = {},
): AnalyzeAndCreateSuggestionsCommand {
  return {
    userId: fixture.userId,
    timezone: "Asia/Seoul",
    locale: "ko",
    localDate: AI_ASSISTANCE_TODAY,
    trigger: "SCHEDULED",
    isFinalAttempt: false,
    ...overrides,
  };
}

// 요청 UseCase가 enqueue와 함께 만드는 실행 기록을 먼저 두고 분석한다. 이미 둔 기록은 그대로 쓴다
export async function analyzeQueuedSuggestions(
  fixture: ReturnType<typeof createAiAssistanceFixture>,
  overrides: Partial<AnalyzeAndCreateSuggestionsCommand> = {},
) {
  const command = createAnalyzeCommand(fixture, overrides);
  const owner = UserId.reconstitute(fixture.userId);
  if ((await fixture.runs.findByUserId(owner)) == null) {
    await fixture.runs.save(
      SuggestionAnalysisRun.create({
        userId: owner,
        localDate: command.localDate,
        trigger: command.trigger,
        now: new DateClock().now(),
      }),
    );
  }
  return fixture.analyze.execute(command);
}

/** 모델이 고른 제안 후보. 기본 기록의 후보 a1은 "책 읽기 10분"(월요일 3회 완료)이다. */
export function createSuggestionPick(overrides: Partial<SuggestionPick> = {}): SuggestionPick {
  return {
    candidateId: "a1",
    daysOfWeek: ["MON"],
    useRecordedTime: false,
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
      evidence: null,
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
