/** 계획 프롬프트 모델 출력의 할 일 하나. 빠진 칸은 schema가 null로 채운다. */
export function todoActionDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: "회의록 보내기",
    categoryId: null,
    date: { kind: "CALENDAR_DATE", year: 2027, month: 1, day: 4 },
    endDate: null,
    time: null,
    repeat: { pattern: "NONE" },
    visibility: null,
    items: [],
    duplicateOfTodoId: null,
    ...overrides,
  };
}

export function memoActionDraft(overrides: Record<string, unknown> = {}) {
  return { title: "아이디어", content: "온보딩 문구 다듬기", ...overrides };
}

export function digestDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: "주간 회의",
    summary: "다음 주 일정을 정했습니다.",
    keyPoints: [{ text: "회의록을 보내기로 했습니다.", sentenceIndex: 1 }],
    todos: [todoActionDraft()],
    memo: null,
    ...overrides,
  };
}
