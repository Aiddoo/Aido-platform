import {
  GOLDEN_VARIANTS,
  loadParseTodoGoldenCases,
  loadQuickPlanGoldenCases,
  loadVoiceNoteDigestGoldenCases,
  type QuickPlanGoldenCase,
  toPlanExpectation,
} from "#test/fixtures/ai-golden/golden-cases";

import { quickPlanPrompt } from "./quick-plan-prompt.messages.js";
import { voiceNoteDigestPrompt } from "./voice-note-digest-prompt.messages.js";

const quickPlanCases = GOLDEN_VARIANTS.flatMap((variant) => loadQuickPlanGoldenCases(variant));
const digestCases = GOLDEN_VARIANTS.flatMap((variant) => loadVoiceNoteDigestGoldenCases(variant));

function normalizeContext(golden: Pick<QuickPlanGoldenCase, "context">) {
  return {
    ownedCategoryIds: new Set(golden.context.categories.map(({ id }) => id)),
    upcomingTodoIds: new Set(golden.context.upcomingTodos.map(({ id }) => id)),
  };
}

describe("계획 golden — 이상적인 모델 출력을 서버가 정규화하면 사람이 확인한 기대값과 같다", () => {
  it("모든 golden 파일의 모든 줄이 각 작업의 schema를 통과한다", () => {
    // Given
    const loaders = GOLDEN_VARIANTS.map((variant) => () => [
      ...loadParseTodoGoldenCases(variant),
      ...loadQuickPlanGoldenCases(variant),
      ...loadVoiceNoteDigestGoldenCases(variant),
    ]);
    // When
    const counts = loaders.map((load) => load().length);
    // Then
    for (const count of counts) {
      expect(count).toBeGreaterThan(5);
    }
  });

  it("golden은 반복 종류·기간·비공개·겹침·메모·빈 계획을 모두 담는다", () => {
    // Given
    const todos = [...quickPlanCases, ...digestCases].flatMap(({ expected }) => expected.todos);
    // When
    const patterns = new Set(todos.map(({ repeat }) => repeat?.pattern ?? "NONE"));
    // Then
    expect([...patterns].sort()).toEqual(
      [
        "BIWEEKLY_DAYS",
        "DAILY",
        "MONTHLY_DAY",
        "NONE",
        "WEEKDAYS",
        "WEEKENDS",
        "WEEKLY_DAYS",
      ].sort(),
    );
    expect(todos.some(({ repeat }) => repeat?.until != null)).toBe(true);
    expect(todos.some(({ endDate, repeat }) => endDate != null && repeat == null)).toBe(true);
    expect(todos.some(({ visibility }) => visibility === "PRIVATE")).toBe(true);
    expect(todos.some(({ duplicateOfTodoId }) => duplicateOfTodoId != null)).toBe(true);
    expect(quickPlanCases.some(({ expected }) => expected.memo != null)).toBe(true);
    expect(quickPlanCases.some(({ expected }) => expected.todos.length === 0)).toBe(true);
  });

  it.each(quickPlanCases)("quick-plan $id $input", (golden) => {
    // Given
    const clock = { now: new Date(golden.now), timeZone: golden.timezone };
    // When
    const plan = quickPlanPrompt.normalize(golden.draft, normalizeContext(golden));
    // Then
    expect(toPlanExpectation(plan, clock)).toEqual(golden.expected);
  });

  it.each(digestCases)("voice-note-digest $id", (golden) => {
    // Given
    const clock = { now: new Date(golden.now), timeZone: golden.timezone };
    const bookmarked = golden.sentences.flatMap(({ isBookmarked }, index) =>
      isBookmarked ? [index] : [],
    );
    // When
    const digest = voiceNoteDigestPrompt.normalize(golden.draft, {
      ...normalizeContext(golden),
      sentenceCount: golden.sentences.length,
    });
    // Then
    const { keyPointSentenceIndexes, ...plan } = golden.expected;
    expect(toPlanExpectation(digest.plan, clock)).toEqual(plan);
    expect(digest.keyPoints.map(({ sentenceIndex }) => sentenceIndex)).toEqual(
      keyPointSentenceIndexes,
    );
    expect(keyPointSentenceIndexes).toEqual(expect.arrayContaining(bookmarked));
  });
});
