import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { GetTodoById } from "./get-todo-by-id.use-case.js";

describe("할 일 상세 조회", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: GetTodoById;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new GetTodoById(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("소유한 할 일의 실제 저장 상태를 응답한다", async () => {
    // Given
    await fixture.todoRepository.createItem(1, { title: "하위 항목", sortOrder: 0 });
    // When
    const result = await useCase.execute({ id: 1, userId: fixture.userId });
    // Then
    expect(result).toMatchObject({
      id: 1,
      userId: fixture.userId,
      startDate: "2026-05-15",
      content: null,
      category: { id: 1 },
      itemStats: { total: 1, completed: 0 },
    });
    expect(result.items[0]?.title).toBe("하위 항목");
  });
  it("없는 할 일과 다른 사용자의 할 일은 같은 오류를 반환한다", async () => {
    // Given / When / Then
    await expect(useCase.execute({ id: 999, userId: fixture.userId })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0801,
      details: { todoId: 999 },
    });
    await expect(useCase.execute({ id: 1, userId: "other-user" })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0801,
      details: { todoId: 1 },
    });
  });
});
