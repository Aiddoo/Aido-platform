import { ACTION_PLAN_LIMITS, MEMO_LIMITS, TODO_ITEM_LIMITS } from "@aido/api/vocabulary";

import type {
  CreateTodoActionDraft,
  VoiceNoteDigestDraft,
} from "../../../domain/types/planning/action-plan-draft.types.js";
import {
  isEmptyActionPlan,
  isEmptyVoiceNoteDigest,
  normalizeActionPlan,
  normalizeVoiceNoteDigest,
} from "./action-plan.normalizer.js";

const context = { ownedCategoryIds: new Set([1, 2]), upcomingTodoIds: new Set([41]) };

function todo(overrides: Partial<CreateTodoActionDraft> = {}): CreateTodoActionDraft {
  return {
    type: "CREATE_TODO",
    title: "운동",
    categoryId: null,
    date: { kind: "NONE" },
    endDate: null,
    time: null,
    repeat: { pattern: "NONE" },
    visibility: null,
    items: [],
    duplicateOfTodoId: null,
    ...overrides,
  };
}

function digest(overrides: Partial<VoiceNoteDigestDraft> = {}): VoiceNoteDigestDraft {
  return { title: "회의", summary: "요약", keyPoints: [], actions: [], ...overrides };
}

describe("normalizeActionPlan", () => {
  it("소유하지 않은 카테고리와 목록에 없는 겹침 id는 null로 바꾼다", () => {
    // Given
    const actions = [todo({ categoryId: 999, duplicateOfTodoId: 7 }), todo({ categoryId: 2 })];
    // When
    const plan = normalizeActionPlan(actions, context);
    // Then
    expect(plan.todos.map(({ categoryId }) => categoryId)).toEqual([null, 2]);
    expect(plan.todos[0]?.duplicateOfTodoId).toBeNull();
    expect(plan.warnings).toEqual(["UNKNOWN_CATEGORY", "UNKNOWN_DUPLICATE"]);
  });

  it("다가오는 할 일 목록에 있는 겹침 id는 그대로 둔다", () => {
    // Given
    const actions = [todo({ duplicateOfTodoId: 41 })];
    // When
    const plan = normalizeActionPlan(actions, context);
    // Then
    expect(plan.todos[0]?.duplicateOfTodoId).toBe(41);
    expect(plan.warnings).toEqual([]);
  });

  it("할 일은 말한 순서대로 상한까지만, 메모는 내용 있는 첫 개만 두고 넘친 수를 알린다", () => {
    // Given
    const todos = Array.from({ length: ACTION_PLAN_LIMITS.MAX_TODOS + 2 }, (_, index) =>
      todo({ title: `할 일 ${index}` }),
    );
    const memos = [
      { type: "CREATE_MEMO", title: "빈 메모", content: "  " },
      { type: "CREATE_MEMO", title: "와이파이", content: "공유기 뒷면" },
      { type: "CREATE_MEMO", title: "둘째", content: "내용" },
    ] as const;
    // When
    const plan = normalizeActionPlan([...memos, ...todos], context);
    // Then
    expect(plan.todos).toHaveLength(ACTION_PLAN_LIMITS.MAX_TODOS);
    expect(plan.todos.at(-1)?.title).toBe(`할 일 ${ACTION_PLAN_LIMITS.MAX_TODOS - 1}`);
    expect(plan.omittedTodoCount).toBe(2);
    expect(plan.memo).toEqual({ title: "와이파이", content: "공유기 뒷면" });
    expect(plan.warnings).toEqual(["TODOS_TRUNCATED", "MEMOS_TRUNCATED"]);
  });

  it("하위 항목은 빈 값·제목 반복·중복을 빼고 기존 하위 할 일 상한으로 자른다", () => {
    // Given
    const items = [
      "운동",
      " ",
      "스트레칭",
      "스트레칭",
      ...Array.from({ length: TODO_ITEM_LIMITS.MAX_PER_TODO }, (_, index) => `항목 ${index}`),
    ];
    // When
    const plan = normalizeActionPlan([todo({ items })], context);
    // Then
    expect(plan.todos[0]?.items).toHaveLength(TODO_ITEM_LIMITS.MAX_PER_TODO);
    expect(plan.todos[0]?.items.slice(0, 2)).toEqual(["스트레칭", "항목 0"]);
    expect(plan.warnings).toEqual(["ITEMS_TRUNCATED"]);
  });

  it("반복 할 일은 하루짜리라 기간(endDate)을 버리고, 반복이 아니면 기간을 둔다", () => {
    // Given
    const monday = { kind: "WEEKDAY", weekday: "MON", weekOffset: 1 } as const;
    const sunday = { kind: "WEEKDAY", weekday: "SUN", weekOffset: 1 } as const;
    const actions = [
      todo({ endDate: sunday, repeat: { pattern: "MONTHLY_DAY", monthDay: 15 } }),
      todo({ title: "출장", date: monday, endDate: sunday }),
    ];
    // When
    const plan = normalizeActionPlan(actions, context);
    // Then
    expect(plan.todos[0]?.schedule).toEqual({
      date: { kind: "NONE" },
      time: null,
      repeat: { pattern: "MONTHLY_DAY", monthDay: 15 },
    });
    expect(plan.todos[1]?.schedule.endDate).toEqual(sunday);
    expect(plan.warnings).toEqual(["REPEAT_WITH_END_DATE"]);
  });

  it("제목의 보이지 않는 문자·연속 공백을 정리하고 빈 제목 할 일은 버린다", () => {
    // Given
    const actions = [todo({ title: " 팀​  standup‮ 준비 " }), todo({ title: "​ " })];
    // When
    const plan = normalizeActionPlan(actions, context);
    // Then
    expect(plan.todos.map(({ title }) => title)).toEqual(["팀 standup 준비"]);
    expect(plan.warnings).toEqual(["EMPTY_TITLE"]);
  });

  it("메모 제목이 비면 내용 첫 줄을 제목으로 쓰고 내용은 메모 상한으로 자른다", () => {
    // Given
    const content = `첫 줄\n${"가".repeat(MEMO_LIMITS.MAX_CONTENT_LENGTH)}`;
    // When
    const plan = normalizeActionPlan([{ type: "CREATE_MEMO", title: "", content }], context);
    // Then
    expect(plan.memo?.title).toBe("첫 줄");
    expect(plan.memo?.content).toHaveLength(MEMO_LIMITS.MAX_CONTENT_LENGTH);
  });

  it("빈 출력은 빈 계획이다", () => {
    // Given
    const actions: CreateTodoActionDraft[] = [];
    // When
    const plan = normalizeActionPlan(actions, context);
    // Then
    expect(plan).toEqual({ todos: [], memo: null, omittedTodoCount: 0, warnings: [] });
    expect(isEmptyActionPlan(plan)).toBe(true);
  });
});

describe("normalizeVoiceNoteDigest", () => {
  it("핵심 포인트의 문장 번호는 준 문장 범위 안의 값만 남긴다", () => {
    // Given
    const keyPoints = [
      { text: "출시일 확정", sentenceIndex: 0 },
      { text: "범위 밖", sentenceIndex: 3 },
      { text: "음수", sentenceIndex: -1 },
      { text: "문장 없음", sentenceIndex: null },
    ];
    // When
    const result = normalizeVoiceNoteDigest(digest({ keyPoints }), {
      ...context,
      sentenceCount: 3,
    });
    // Then
    expect(result.keyPoints.map(({ sentenceIndex }) => sentenceIndex)).toEqual([
      0,
      null,
      null,
      null,
    ]);
  });

  it("핵심 포인트는 빈 값·같은 문장을 빼고 상한까지만 두며 제목·요약을 길이 상한으로 자른다", () => {
    // Given
    const keyPoints = [
      { text: " ", sentenceIndex: 0 },
      ...Array.from({ length: ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS + 2 }, (_, index) => ({
        text: `포인트 ${index % (ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS + 1)}`,
        sentenceIndex: index,
      })),
    ];
    const draft = digest({
      title: `  회의\n${"가".repeat(ACTION_PLAN_LIMITS.DIGEST_TITLE_MAX_LENGTH)}`,
      summary: "나".repeat(ACTION_PLAN_LIMITS.DIGEST_SUMMARY_MAX_LENGTH + 10),
      keyPoints,
    });
    // When
    const result = normalizeVoiceNoteDigest(draft, { ...context, sentenceCount: 100 });
    // Then
    expect(result.keyPoints).toHaveLength(ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS);
    expect(result.keyPoints[0]).toEqual({ text: "포인트 0", sentenceIndex: 0 });
    expect(result.title.startsWith("회의 가")).toBe(true);
    expect(result.title).toHaveLength(ACTION_PLAN_LIMITS.DIGEST_TITLE_MAX_LENGTH);
    expect(result.summary).toHaveLength(ACTION_PLAN_LIMITS.DIGEST_SUMMARY_MAX_LENGTH);
  });

  it("요약·핵심 포인트·계획이 모두 비면 빈 정리이고 요약만 있으면 빈 정리가 아니다", () => {
    // Given
    const empty = digest({ title: "", summary: " " });
    const summaryOnly = digest({ summary: "할 일 없이 생각만 정리했어요." });
    // When
    const results = [empty, summaryOnly].map((draft) =>
      normalizeVoiceNoteDigest(draft, { ...context, sentenceCount: 0 }),
    );
    // Then
    expect(results.map(isEmptyVoiceNoteDigest)).toEqual([true, false]);
  });

  it("행동은 빠른 계획과 같은 규칙으로 정규화한다", () => {
    // Given
    const actions = [todo({ categoryId: 999, items: ["우유", "우유"] })];
    // When
    const result = normalizeVoiceNoteDigest(digest({ actions }), { ...context, sentenceCount: 0 });
    // Then
    expect(result.plan.todos[0]).toMatchObject({ categoryId: null, items: ["우유"] });
  });
});
