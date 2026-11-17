import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { StubUserLocalePreferenceReader } from "#test/mocks/ports/ai-parsing.stub";
import { suppressLogger } from "#test/setup/suppress-logger";

import type { AnalyzeAndCreateSuggestionsCommand } from "../../application/use-cases/analyze-and-create-suggestions.use-case.js";
import type {
  SuggestionAnalysisOutcome,
  SuggestionAnalysisTrigger,
} from "../../domain/suggestion-analysis.constants.js";
import { AiSuggestionJobName } from "./ai-suggestion.queue.js";
import { SuggestionAnalysisProcessor } from "./suggestion-analysis.processor.js";

// LA 2026-11-16 09:30(PST)
const NOW = Temporal.Instant.from("2026-11-16T17:30:00Z");

function setup(outcome: SuggestionAnalysisOutcome = "SUGGESTIONS_CREATED") {
  const commands: AnalyzeAndCreateSuggestionsCommand[] = [];
  const publisher = new RecordingNotificationPublisher();
  const localePreferenceReader = new StubUserLocalePreferenceReader();
  localePreferenceReader.preferences.set("user-1", {
    timezone: "America/Los_Angeles",
    locale: "en",
  });
  let dispatched = 0;
  const processor = new SuggestionAnalysisProcessor(
    {
      execute: async (command) => {
        commands.push(command);
        return {
          outcome,
          trigger: command.trigger,
          recentTodoCount: 3,
          createdSuggestionCount: outcome === "SUGGESTIONS_CREATED" ? 2 : 0,
        };
      },
    },
    publisher.single,
    localePreferenceReader,
    {
      dispatchAnalysis: async () => {
        dispatched += 1;
      },
    },
    new InMemoryJobQueue(),
    new FixedClock(NOW),
  );
  return { processor, commands, publisher, dispatched: () => dispatched };
}

function analyzeJob(trigger: SuggestionAnalysisTrigger = "SCHEDULED") {
  return {
    name: AiSuggestionJobName.ANALYZE,
    data: {
      userId: "user-1",
      timezone: "America/Los_Angeles",
      weatherGrid: null,
      localDate: "2026-11-16",
      trigger,
    },
  } as const;
}

describe("SuggestionAnalysisProcessor", () => {
  beforeEach(suppressLogger);

  it("새 제안이 생기면 저장 언어로 분석하고 알림함이 요청 언어로 다시 그릴 문구 키를 함께 보낸다", async () => {
    // Given
    const { processor, commands, publisher } = setup();

    // When
    await processor.process(analyzeJob(), 3);

    // Then
    expect(commands).toEqual([
      {
        userId: "user-1",
        timezone: "America/Los_Angeles",
        locale: "en",
        localDate: Temporal.PlainDate.from("2026-11-16"),
        trigger: "SCHEDULED",
        isFinalAttempt: true,
      },
    ]);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.data).toMatchObject({
      userId: "user-1",
      type: "AI_SUGGESTION",
      purpose: "SCHEDULED_SERVICE",
      campaignKey: "ai_suggestion_v2",
      copyKey: expect.any(String),
    });
  });

  it.each([
    { trigger: "SCHEDULED", outcome: "SUGGESTIONS_CREATED", notified: 1 },
    { trigger: "ON_DEMAND", outcome: "SUGGESTIONS_CREATED", notified: 0 },
    { trigger: "SCHEDULED", outcome: "NOT_PREMIUM", notified: 0 },
    { trigger: "SCHEDULED", outcome: "NO_PATTERN_FOUND", notified: 0 },
  ] as const)(
    "$trigger 분석의 결과가 $outcome이면 푸시를 $notified번 보낸다",
    async ({ trigger, outcome, notified }) => {
      // Given
      const { processor, publisher } = setup(outcome);

      // When
      await processor.process(analyzeJob(trigger));

      // Then
      expect(publisher.published).toHaveLength(notified);
    },
  );

  it("1.16.0 전에 쌓인 작업은 아침 배치로 보고 실행 시각의 현지 날짜로 분석한다", async () => {
    // Given
    const { processor, commands, publisher } = setup();

    // When
    await processor.process(
      {
        name: AiSuggestionJobName.ANALYZE,
        data: { userId: "user-1", timezone: "America/Los_Angeles", weatherGrid: null },
      },
      1,
    );

    // Then
    expect(commands[0]).toMatchObject({
      localDate: Temporal.PlainDate.from("2026-11-16"),
      trigger: "SCHEDULED",
      isFinalAttempt: false,
    });
    expect(publisher.published).toHaveLength(1);
  });

  it("디스패치 작업은 현지 제안 창 사용자를 고르는 디스패처에 넘긴다", async () => {
    // Given
    const { processor, dispatched } = setup();

    // When
    await processor.process({ name: AiSuggestionJobName.DISPATCH, data: {} });

    // Then
    expect(dispatched()).toBe(1);
  });
});
