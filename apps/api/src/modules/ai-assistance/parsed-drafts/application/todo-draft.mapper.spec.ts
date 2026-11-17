import { createTodoDraftResponse, type TodoDraftInput } from "#test/fixtures/ai-response.fixture";

import { normalizeMemoDraft } from "./todo-draft.mapper.js";

function normalizeMemo(draft: TodoDraftInput, clock: { now: Date; timezone: string }) {
  return normalizeMemoDraft(
    {
      todos: [{ ...createTodoDraftResponse(draft), items: [], duplicateOfTodoId: null }],
      totalTaskCount: 1,
    },
    {
      ...clock,
      locale: "ko",
      ownedCategoryIds: new Set([7]),
      fallbackTitle: "메모",
      defaultCategoryId: 7,
      upcomingTodos: [],
    },
  ).parsedMemo.todos[0];
}

describe("normalizeMemoDraft — 이번 주말", () => {
  it.each([
    {
      name: "서울 목요일",
      clock: { now: new Date("2026-11-05T01:00:00Z"), timezone: "Asia/Seoul" },
      saturday: "2026-11-07",
      sunday: "2026-11-08",
    },
    {
      // 같은 순간 서울은 이미 일요일이지만 LA는 토요일 저녁이라 LA의 오늘(토요일)이다
      name: "LA 토요일 저녁",
      clock: { now: new Date("2026-11-08T03:00:00Z"), timezone: "America/Los_Angeles" },
      saturday: "2026-11-07",
      sunday: "2026-11-08",
    },
  ])(
    "$name에 말한 이번 주말은 새 앱 repeat에서 토요일 한 번이고 출시 앱 recurrence는 그대로다",
    ({ clock, saturday, sunday }) => {
      // When
      const todo = normalizeMemo({ repeat: { pattern: "THIS_WEEKEND" } }, clock);

      // Then
      expect(todo).toMatchObject({
        startDate: saturday,
        endDate: null,
        repeat: null,
        isRecurring: true,
        recurrence: { daysOfWeek: ["SAT", "SUN"], endDate: sunday },
      });
    },
  );

  it("주말마다처럼 끝이 다음 날보다 뒤인 주말 반복은 그대로 반복이다", () => {
    // Given
    const clock = { now: new Date("2026-11-05T01:00:00Z"), timezone: "Asia/Seoul" };

    // When
    const todo = normalizeMemo(
      {
        repeat: {
          pattern: "WEEKENDS",
          forDuration: { unit: "WEEK", amount: 3 },
        },
      },
      clock,
    );

    // Then
    expect(todo?.repeat).toMatchObject({ frequency: "WEEKLY", weekdays: ["SAT", "SUN"] });
  });
});
