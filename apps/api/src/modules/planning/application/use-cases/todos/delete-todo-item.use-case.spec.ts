import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { DeleteTodoItem } from "./delete-todo-item.use-case.js";

describe("하위 항목 삭제", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: DeleteTodoItem;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new DeleteTodoItem(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("요청한 항목만 삭제하고 다른 항목과 통계를 보존한다", async () => {
    // Given
    await fixture.todoRepository.createInlineItems(1, [
      { title: "첫 항목" },
      { title: "둘째 항목" },
    ]);
    // When
    const result = await useCase.execute({ todoId: 1, itemId: 1, userId: fixture.userId });
    // Then
    expect(result.items.map((item) => item.title)).toEqual(["둘째 항목"]);
    expect(result.itemStats).toEqual({ total: 1, completed: 0 });
    expect(fixture.records.get(1)?.items).toHaveLength(1);
  });
  it("없는 항목과 다른 소유자의 할 일은 상태를 바꾸지 않는다", async () => {
    // Given
    await fixture.todoRepository.createItem(1, { title: "기존 항목", sortOrder: 0 });
    const before = structuredClone(fixture.records.get(1));
    // When / Then
    await expect(
      useCase.execute({ todoId: 1, itemId: 999, userId: fixture.userId }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0822 });
    await expect(
      useCase.execute({ todoId: 1, itemId: 1, userId: "other-user" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(fixture.records.get(1)).toEqual(before);
  });
});
