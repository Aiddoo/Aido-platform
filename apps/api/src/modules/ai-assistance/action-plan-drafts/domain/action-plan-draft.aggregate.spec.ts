import { ErrorCode } from "@aido/api/errors";
import { ACTION_PLAN_LIMITS } from "@aido/api/vocabulary";

import { ActionPlanDraft, type ActionPlanDraftPrimitives } from "./action-plan-draft.aggregate.js";

type ActionPlanTodo = ActionPlanDraftPrimitives["todos"][number];

function planTodo(overrides: Partial<ActionPlanTodo> = {}): ActionPlanTodo {
  return {
    title: "운동",
    categoryId: null,
    startDate: "2027-01-04",
    endDate: null,
    scheduledTime: null,
    repeat: null,
    visibility: null,
    items: [],
    duplicateOfTodoId: null,
    ...overrides,
  };
}

describe("ActionPlanDraft", () => {
  it("할 일이 계획 상한을 넘으면 만들지 않는다", () => {
    // Given
    const todos = Array.from({ length: ACTION_PLAN_LIMITS.MAX_TODOS + 1 }, () => planTodo());

    // When
    const create = () => ActionPlanDraft.create({ todos, memo: null, omittedTodoCount: 0 });

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0001 }));
  });

  it("반복 할 일은 기간(endDate)을 버리고 단발 할 일은 기간을 그대로 둔다", () => {
    // Given
    const repeating = planTodo({
      endDate: "2027-01-10",
      repeat: { frequency: "DAILY", end: { type: "NEVER" } },
    });
    const single = planTodo({ endDate: "2027-01-10" });

    // When
    const draft = ActionPlanDraft.create({
      todos: [repeating, single],
      memo: null,
      omittedTodoCount: 0,
    });

    // Then
    expect(draft.toPrimitives().todos.map((todo) => todo.endDate)).toEqual([null, "2027-01-10"]);
  });
});
