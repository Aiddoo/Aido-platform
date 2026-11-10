import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { StubUserLocalePreferenceReader } from "#test/mocks/ports/ai-parsing.stub";

import type { AnalyzeAndCreateSuggestionsCommand } from "../../application/use-cases/analyze-and-create-suggestions.use-case.js";
import { AiSuggestionJobName } from "./ai-suggestion.queue.js";
import { SuggestionAnalysisProcessor } from "./suggestion-analysis.processor.js";

function setup(createdCount: number) {
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
        return createdCount;
      },
    },
    publisher,
    localePreferenceReader,
    {
      dispatchAnalysis: async () => {
        dispatched += 1;
      },
    },
    new InMemoryJobQueue(),
  );
  return { processor, commands, publisher, dispatched: () => dispatched };
}

const analyzeJob = {
  name: AiSuggestionJobName.ANALYZE,
  data: { userId: "user-1", timezone: "America/Los_Angeles", weatherGrid: null },
} as const;

describe("SuggestionAnalysisProcessor", () => {
  it("새 제안이 생기면 저장 언어로 분석하고 알림함이 요청 언어로 다시 그릴 문구 키를 함께 보낸다", async () => {
    // Given
    const { processor, commands, publisher } = setup(2);

    // When
    await processor.process(analyzeJob);

    // Then
    expect(commands).toEqual([
      { userId: "user-1", timezone: "America/Los_Angeles", weatherGrid: null, locale: "en" },
    ]);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.data).toMatchObject({
      userId: "user-1",
      type: "AI_SUGGESTION",
      campaignKey: "ai_suggestion_v2",
      copyKey: expect.any(String),
    });
  });

  it("새 제안이 없으면 알림을 보내지 않는다", async () => {
    // Given
    const { processor, publisher } = setup(0);

    // When
    await processor.process(analyzeJob);

    // Then
    expect(publisher.published).toEqual([]);
  });

  it("디스패치 작업은 현지 07시대 사용자를 고르는 디스패처에 넘긴다", async () => {
    // Given
    const { processor, dispatched } = setup(0);

    // When
    await processor.process({ name: AiSuggestionJobName.DISPATCH, data: {} });

    // Then
    expect(dispatched()).toBe(1);
  });
});
