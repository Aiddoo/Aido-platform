import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
  snapshotTodoRecord,
} from "#test/fixtures/planning/planning-todos.fixture";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import { TodoItemId } from "../../../shared/domain/todo-item-id.vo.js";
import { UpdateTodoItemUseCase } from "./update-todo-item.use-case.js";

describe("하위 항목 수정", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: UpdateTodoItemUseCase;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new UpdateTodoItemUseCase(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("제목과 false 완료 값을 저장하고 다른 항목은 보존한다", async () => {
    // Given
    await fixture.todoRepository.createInlineItems(TodoId.reconstitute(1), [
      { title: "첫 항목" },
      { title: "둘째 항목" },
    ]);
    await fixture.todoRepository.updateItem(TodoItemId.reconstitute(1), { completed: true });
    // When
    const result = await useCase.execute({
      todoId: 1,
      itemId: 1,
      userId: fixture.userId,
      data: { title: "수정된 항목", completed: false },
    });
    // Then
    expect(result.items.map((item) => ({ title: item.title, completed: item.completed }))).toEqual([
      { title: "수정된 항목", completed: false },
      { title: "둘째 항목", completed: false },
    ]);
  });
  it("다른 부모의 항목과 없는 할 일은 거부하고 상태를 보존한다", async () => {
    // Given
    await fixture.todoRepository.seedItem(1, { title: "기존 항목", sortOrder: 0 });
    const before = snapshotTodoRecord(fixture.records.get(1));
    // When / Then
    await expect(
      useCase.execute({
        todoId: 1,
        itemId: 999,
        userId: fixture.userId,
        data: { title: "잘못된 수정" },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0822 });
    await expect(
      useCase.execute({
        todoId: 999,
        itemId: 1,
        userId: fixture.userId,
        data: { title: "잘못된 수정" },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    await expect(
      useCase.execute({
        todoId: 1,
        itemId: 1,
        userId: fixture.userId,
        data: { title: "가".repeat(201) },
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(fixture.records.get(1)).toEqual(before);
  });
});
