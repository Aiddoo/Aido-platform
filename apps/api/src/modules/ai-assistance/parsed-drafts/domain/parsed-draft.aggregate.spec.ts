import { ErrorCode } from "@aido/api/errors";
import { AI_PARSE_LIMITS } from "@aido/api/vocabulary";

import { ParsedDraft } from "./parsed-draft.aggregate.js";
import type { ParsedTodo } from "./parsed-drafts.constants.js";

function parsedTodos(count: number): ParsedTodo[] {
  return Array.from({ length: count }, (_, index) => ({
    title: `할 일 ${index + 1}`,
    startDate: "2027-01-04",
    endDate: null,
    scheduledTime: null,
    isAllDay: true,
    isRecurring: false,
    recurrence: null,
  }));
}

describe("ParsedDraft", () => {
  it.each([
    ["할 일이 없으면", { todos: parsedTodos(0), omittedTodoCount: 0, hasAction: true }],
    [
      "할 일이 메모 상한을 넘으면",
      {
        todos: parsedTodos(AI_PARSE_LIMITS.MEMO_MAX_TODOS + 1),
        omittedTodoCount: 0,
        hasAction: true,
      },
    ],
    [
      "실행할 할 일이 없는 초안이 만들지 않은 할 일을 두면",
      { todos: parsedTodos(1), omittedTodoCount: 2, hasAction: false },
    ],
  ])("%s 만들지 않는다", (_title, params) => {
    // When
    const create = () => ParsedDraft.create(params);

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0001 }));
  });

  it.each([
    ["실행할 할 일이 있으면 차감하는 초안이다", true],
    ["실행할 할 일이 없으면 차감하지 않는 초안이다", false],
  ])("%s", (_title, hasAction) => {
    // When
    const draft = ParsedDraft.create({
      todos: parsedTodos(AI_PARSE_LIMITS.MEMO_MAX_TODOS),
      omittedTodoCount: 0,
      hasAction,
    });

    // Then
    expect(draft.hasAction()).toBe(hasAction);
  });
});
