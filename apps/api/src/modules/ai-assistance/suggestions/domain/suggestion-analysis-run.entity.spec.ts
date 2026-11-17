import {
  createSuggestionAnalysisRunFixture,
  SUGGESTION_ANALYSIS_RUN_FIXTURE_TODAY,
} from "#test/fixtures/ai-assistance/suggestion-analysis-run.fixture";
import { SUGGESTION_FIXTURE_NOW } from "#test/fixtures/ai-assistance/suggestion.fixture";

import { RUN_STALE_AFTER_MINUTES } from "./suggestion-analysis.constants.js";

const TODAY = SUGGESTION_ANALYSIS_RUN_FIXTURE_TODAY;
const TOMORROW = TODAY.add({ days: 1 });
const QUEUED_AT = SUGGESTION_FIXTURE_NOW;
const LATER = QUEUED_AT.add({ minutes: 5 });
const RESULT = {
  outcome: "SUGGESTIONS_CREATED",
  recentTodoCount: 12,
  createdSuggestionCount: 2,
} as const;

describe("SuggestionAnalysisRun", () => {
  it.each([
    [
      "같은 날 다시 요청하면 끝난 기록을 그대로 둔다",
      TODAY,
      TODAY,
      false,
      { status: "FINISHED", localDate: TODAY, ...RESULT },
    ],
    [
      "다음 날 요청하면 결과를 비우고 다시 큐에 넣는다",
      TODAY,
      TOMORROW,
      true,
      {
        status: "QUEUED",
        localDate: TOMORROW,
        trigger: "ON_DEMAND",
        outcome: null,
        recentTodoCount: null,
        createdSuggestionCount: null,
        queuedAt: LATER,
        startedAt: null,
        finishedAt: null,
      },
    ],
    [
      "서울 11-16에 요청한 뒤 LA로 옮겨 현지 11-15에 요청하면 다른 날이다",
      Temporal.PlainDate.from("2026-11-16"),
      Temporal.PlainDate.from("2026-11-15"),
      true,
      { status: "QUEUED", localDate: Temporal.PlainDate.from("2026-11-15") },
    ],
    [
      "LA로 옮겨도 현지 날짜가 같은 11-16이면 같은 날이다",
      Temporal.PlainDate.from("2026-11-16"),
      Temporal.PlainDate.from("2026-11-16"),
      false,
      { status: "FINISHED", localDate: Temporal.PlainDate.from("2026-11-16") },
    ],
    [
      "연말 12-31 다음 1-1은 다른 날이다",
      Temporal.PlainDate.from("2026-12-31"),
      Temporal.PlainDate.from("2027-01-01"),
      true,
      { status: "QUEUED", localDate: Temporal.PlainDate.from("2027-01-01") },
    ],
    [
      "윤일 2-29 다음 3-1은 다른 날이다",
      Temporal.PlainDate.from("2028-02-29"),
      Temporal.PlainDate.from("2028-03-01"),
      true,
      { status: "QUEUED", localDate: Temporal.PlainDate.from("2028-03-01") },
    ],
  ] as const)("%s", (_title, requestedDate, localDate, changed, expected) => {
    // Given
    const run = createSuggestionAnalysisRunFixture({
      status: "FINISHED",
      localDate: requestedDate,
      ...RESULT,
      startedAt: QUEUED_AT,
      finishedAt: QUEUED_AT,
    });

    // When
    const result = run.request({ localDate, trigger: "ON_DEMAND", now: LATER });

    // Then
    expect(result).toBe(changed);
    expect(run.toPrimitives()).toMatchObject(expected);
  });

  it.each([
    ["큐에 있던 오늘 실행은 시작한다", "QUEUED", TODAY, true, "RUNNING"],
    ["이미 시작한 실행의 재시도는 그대로 둔다", "RUNNING", TODAY, false, "RUNNING"],
    ["끝난 실행은 다시 시작하지 않는다", "FINISHED", TODAY, false, "FINISHED"],
    ["다른 날 job은 오늘 실행을 시작하지 않는다", "QUEUED", TOMORROW, false, "QUEUED"],
  ] as const)("%s", (_title, status, localDate, changed, nextStatus) => {
    // Given
    const run = createSuggestionAnalysisRunFixture({ status });

    // When
    const result = run.start(localDate, LATER);

    // Then
    expect(result).toBe(changed);
    expect(run.toPrimitives().status).toBe(nextStatus);
  });

  it.each([
    ["시작 전 실행도 끝낼 수 있다", "QUEUED", TODAY, true, "FINISHED"],
    ["분석 중인 실행을 끝낸다", "RUNNING", TODAY, true, "FINISHED"],
    ["이미 끝난 실행은 결과를 덮지 않는다", "FINISHED", TODAY, false, "FINISHED"],
    ["다른 날 job은 오늘 실행을 끝내지 않는다", "RUNNING", TOMORROW, false, "RUNNING"],
  ] as const)("%s", (_title, status, localDate, changed, nextStatus) => {
    // Given
    const run = createSuggestionAnalysisRunFixture({ status });

    // When
    const result = run.finish(localDate, RESULT, LATER);

    // Then
    expect(result).toBe(changed);
    expect(run.toPrimitives().status).toBe(nextStatus);
  });

  it.each([
    ["큐에 넣은 지 59분이면 분석 중이다", "QUEUED", RUN_STALE_AFTER_MINUTES - 1, true],
    ["큐에 넣은 지 60분이면 아직 분석 중이다", "QUEUED", RUN_STALE_AFTER_MINUTES, true],
    ["큐에 넣은 지 60분이 넘으면 멈춘 실행이다", "QUEUED", RUN_STALE_AFTER_MINUTES + 1, false],
    ["시작한 실행도 큐에 넣은 지 60분까지 분석 중이다", "RUNNING", RUN_STALE_AFTER_MINUTES, true],
    [
      "시작한 실행도 큐에 넣은 지 60분이 넘으면 멈춘 실행이다",
      "RUNNING",
      RUN_STALE_AFTER_MINUTES + 1,
      false,
    ],
    ["끝난 실행은 분석 중이 아니다", "FINISHED", 0, false],
  ] as const)("%s", (_title, status, elapsedMinutes, expected) => {
    // Given
    const run = createSuggestionAnalysisRunFixture({ status });

    // When
    const result = run.isRunning(QUEUED_AT.add({ minutes: elapsedMinutes }));

    // Then
    expect(result).toBe(expected);
  });
});
