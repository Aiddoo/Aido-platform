import { DAYS_OF_WEEK } from "@aido/api/vocabulary";

import {
  createAiAssistanceFixture,
  withAiAssistanceTime,
} from "#test/fixtures/ai-assistance.fixture";
import {
  GOLDEN_VARIANTS,
  loadSuggestionGoldenCases,
  type SuggestionGoldenCase,
  toSuggestionContext,
} from "#test/fixtures/ai-golden/golden-cases";
import { readPromptBlock } from "#test/fixtures/ai-prompt.fixture";

import {
  buildSuggestionCandidates,
  suggestionModeOf,
} from "../../domain/suggestion-candidates.domain-service.js";
import type { SuggestionData } from "../messages/suggestion-data.messages.js";

const cases = GOLDEN_VARIANTS.flatMap((variant) => loadSuggestionGoldenCases(variant));

async function analyze(golden: SuggestionGoldenCase, picks: unknown) {
  const fixture = createAiAssistanceFixture();
  const context = toSuggestionContext(golden);
  fixture.activityReader.todos = context.todos;
  fixture.activityReader.history = context.suggestionHistory;
  fixture.generator.setRawResponse({ picks });
  const count = await withAiAssistanceTime(
    () =>
      fixture.analyze.execute({
        userId: fixture.userId,
        timezone: golden.timezone,
        locale: golden.locale,
      }),
    new Date(golden.now),
  );
  const candidates = buildGoldenCandidates(golden);
  const saved = fixture.repository.created.map((suggestion) => ({
    suggestion,
    candidate: candidates.find((candidate) => candidate.title === suggestion.title),
  }));
  return { fixture, count, saved };
}

function buildGoldenCandidates(golden: SuggestionGoldenCase) {
  const { todos } = toSuggestionContext(golden);
  return buildSuggestionCandidates(todos, suggestionModeOf(todos.length));
}

describe("AnalyzeAndCreateSuggestionsUseCase golden — fake model 출력을 서버가 상한·이력·요일·시각으로 정리한다", () => {
  it("모든 golden 줄이 schema를 통과하고 기록 양·이상한 제목·안전·이력·시간 사례를 담는다", () => {
    // When
    const ids = new Set(cases.map(({ id }) => id));
    // Then
    expect(ids.size).toBe(cases.length);
    expect(cases.some(({ todos }) => todos.length === 0)).toBe(true);
    expect(cases.some(({ todos }) => todos.length >= 300)).toBe(true);
    expect(cases.some(({ expected }) => expected.mode === "STARTER" && expected.maxPicks > 0)).toBe(
      true,
    );
    expect(cases.some(({ expected }) => expected.atMostOneOf.length > 0)).toBe(true);
    expect(cases.some(({ history }) => history.some(({ status }) => status === "ACCEPTED"))).toBe(
      true,
    );
    expect(cases.some(({ history }) => history.some(({ status }) => status === "DISMISSED"))).toBe(
      true,
    );
    expect(
      cases.some(({ todos }) => todos.some(({ title }) => title.includes("</suggestion_data>"))),
    ).toBe(true);
  });

  it.each(cases)("$id 이상적인 출력은 허용 후보만 상한 안에서 저장한다", async (golden) => {
    // Given
    const { expected } = golden;
    // When
    const { fixture, count, saved } = await analyze(golden, golden.draft.picks);
    // Then
    if (golden.todos.length === 0) {
      expect(fixture.generator.getCallCount()).toBe(0);
      expect(count).toBe(0);
      return;
    }
    const data: SuggestionData = readPromptBlock(
      fixture.generator.getLastPrompt() ?? "",
      "suggestion_data",
    );
    const promptIds = data.candidates.map(({ id }) => id);
    expect(data.mode).toBe(expected.mode);
    expect(promptIds).toEqual(
      expect.arrayContaining([...expected.allowedCandidateIds, ...expected.forbiddenCandidateIds]),
    );
    const savedIds = saved.map(({ candidate }) => candidate?.id);
    expect(count).toBeLessThanOrEqual(expected.maxPicks);
    expect(savedIds.every((id) => id != null && expected.allowedCandidateIds.includes(id))).toBe(
      true,
    );
    expect(count).toBe(expected.expectNone ? 0 : golden.draft.picks.length);
    for (const group of expected.atMostOneOf) {
      expect(savedIds.filter((id) => id != null && group.includes(id)).length).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it.each(cases.filter(({ todos }) => todos.length > 0))(
    "$id 모든 후보·요일·시각을 고른 출력도 상한·응답 이력·기록 요일·기록 시각을 넘지 않는다",
    async (golden) => {
      // Given
      const greedy = buildGoldenCandidates(golden).map(({ id }) => ({
        candidateId: id,
        daysOfWeek: [...DAYS_OF_WEEK],
        useRecordedTime: true,
      }));
      const respondedTitles = new Set(golden.history.map(({ title }) => title));
      // When
      const { count, saved } = await analyze(golden, greedy);
      // Then
      expect(count).toBeLessThanOrEqual(golden.expected.maxPicks);
      for (const { suggestion, candidate } of saved) {
        expect(candidate).toBeDefined();
        expect(respondedTitles.has(suggestion.title)).toBe(false);
        const recordedDays = candidate?.days.map(({ day }) => day) ?? [];
        expect((suggestion.daysOfWeek ?? []).every((day) => recordedDays.includes(day))).toBe(true);
        expect(suggestion.scheduledTime).toBe(candidate?.recordedTime ?? null);
      }
    },
  );
});
