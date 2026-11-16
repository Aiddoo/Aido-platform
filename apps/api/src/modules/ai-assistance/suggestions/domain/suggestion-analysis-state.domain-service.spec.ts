import {
  createSuggestionAnalysisRunFixture,
  SUGGESTION_ANALYSIS_RUN_FIXTURE_TODAY,
} from "#test/fixtures/ai-assistance/suggestion-analysis-run.fixture";

import {
  canRequestAnalysisNow,
  resolveSuggestionAnalysisState,
  type SuggestionAnalysisFacts,
} from "./suggestion-analysis-state.domain-service.js";
import {
  RUN_STALE_AFTER_MINUTES,
  type SuggestionAnalysisOutcome,
} from "./suggestion-analysis.constants.js";

const TODAY = SUGGESTION_ANALYSIS_RUN_FIXTURE_TODAY;
// 서울 2026-03-04 12:00
const NOW = Temporal.Instant.from("2026-03-04T03:00:00Z");

function facts(overrides: Partial<SuggestionAnalysisFacts> = {}): SuggestionAnalysisFacts {
  return {
    pendingCount: 0,
    hasAiConsent: true,
    recentTodoCount: 3,
    run: null,
    now: NOW,
    timeZone: "Asia/Seoul",
    ...overrides,
  };
}

function runningRun() {
  return createSuggestionAnalysisRunFixture({
    status: "RUNNING",
    localDate: TODAY,
    queuedAt: NOW.subtract({ minutes: 5 }),
  });
}

function finishedToday(outcome: SuggestionAnalysisOutcome) {
  return createSuggestionAnalysisRunFixture({
    status: "FINISHED",
    localDate: TODAY,
    outcome,
    queuedAt: NOW.subtract({ hours: 2 }),
  });
}

describe("resolveSuggestionAnalysisState", () => {
  it.each([
    {
      name: "대기 제안이 있으면 동의·기록·분석 중보다 먼저",
      input: facts({ pendingCount: 1, hasAiConsent: false, recentTodoCount: 0, run: runningRun() }),
      expected: "HAS_SUGGESTIONS",
    },
    {
      name: "동의가 없으면 기록 수보다 먼저",
      input: facts({ hasAiConsent: false, recentTodoCount: 0 }),
      expected: "NEEDS_AI_CONSENT",
    },
    {
      name: "최근 단건 할 일이 없으면 분석 중보다 먼저",
      input: facts({ recentTodoCount: 0, run: runningRun() }),
      expected: "NEEDS_MORE_TODOS",
    },
    { name: "60분이 안 된 실행", input: facts({ run: runningRun() }), expected: "ANALYZING" },
    {
      name: "오늘 제안을 만든 실행",
      input: facts({ run: finishedToday("SUGGESTIONS_CREATED") }),
      expected: "DONE_FOR_TODAY",
    },
    {
      name: "오늘 패턴을 못 찾은 실행",
      input: facts({ run: finishedToday("NO_PATTERN_FOUND") }),
      expected: "NO_PATTERN_FOUND",
    },
    {
      name: "오늘 최근 기록이 없던 실행",
      input: facts({ run: finishedToday("NO_RECENT_TODOS") }),
      expected: "NO_PATTERN_FOUND",
    },
    {
      name: "오늘 AI를 쓸 수 없던 실행",
      input: facts({ run: finishedToday("AI_UNAVAILABLE") }),
      expected: "UNAVAILABLE_TODAY",
    },
    {
      name: "오늘 비용 한도에 걸린 실행",
      input: facts({ run: finishedToday("SPEND_LIMIT_REACHED") }),
      expected: "UNAVAILABLE_TODAY",
    },
    {
      name: "오늘 실패한 실행",
      input: facts({ run: finishedToday("FAILED") }),
      expected: "UNAVAILABLE_TODAY",
    },
    {
      name: "오늘 요청했지만 60분 넘게 멈춘 실행",
      input: facts({
        run: createSuggestionAnalysisRunFixture({
          status: "RUNNING",
          localDate: TODAY,
          queuedAt: NOW.subtract({ minutes: RUN_STALE_AFTER_MINUTES + 1 }),
        }),
      }),
      expected: "UNAVAILABLE_TODAY",
    },
    {
      name: "어제 끝난 실행",
      input: facts({
        run: createSuggestionAnalysisRunFixture({
          status: "FINISHED",
          localDate: TODAY.subtract({ days: 1 }),
          outcome: "SUGGESTIONS_CREATED",
          queuedAt: NOW.subtract({ hours: 24 }),
        }),
      }),
      expected: "WAITING_FOR_NEXT_RUN",
    },
    { name: "분석한 적 없음", input: facts(), expected: "WAITING_FOR_NEXT_RUN" },
  ])("$name → $expected", ({ input, expected }) => {
    // When
    const state = resolveSuggestionAnalysisState(input);

    // Then
    expect(state).toBe(expected);
  });
});

describe("canRequestAnalysisNow", () => {
  it.each([
    { name: "서울 23:59", now: "2026-11-15T14:59:00Z", timeZone: "Asia/Seoul", expected: false },
    { name: "서울 자정", now: "2026-11-15T15:00:00Z", timeZone: "Asia/Seoul", expected: true },
    {
      name: "LA 23:59(PST)",
      now: "2026-11-16T07:59:00Z",
      timeZone: "America/Los_Angeles",
      expected: false,
    },
    {
      name: "LA 자정(PST)",
      now: "2026-11-16T08:00:00Z",
      timeZone: "America/Los_Angeles",
      expected: true,
    },
  ])(
    "현지 11-15에 끝난 분석은 $name에 다시 받을 수 있는지: $expected",
    ({ now, timeZone, expected }) => {
      // Given
      const run = createSuggestionAnalysisRunFixture({
        status: "FINISHED",
        localDate: Temporal.PlainDate.from("2026-11-15"),
        outcome: "SUGGESTIONS_CREATED",
        queuedAt: Temporal.Instant.from("2026-11-15T00:00:00Z"),
      });

      // When
      const canRequest = canRequestAnalysisNow(
        resolveSuggestionAnalysisState(facts({ run, now: Temporal.Instant.from(now), timeZone })),
      );

      // Then
      expect(canRequest).toBe(expected);
    },
  );
});
