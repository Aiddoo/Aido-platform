import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { ReorderTodoItems } from "./reorder-todo-items.use-case.js";

describe("하위 항목 순서 변경", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: ReorderTodoItems;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new ReorderTodoItems(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("전체 ID 순서대로 항목을 저장하고 새 연속 순서를 반환한다", async () => {
    // Given
    await fixture.todoRepository.createInlineItems(1, [
      { title: "첫 항목" },
      { title: "둘째 항목" },
      { title: "셋째 항목" },
    ]);
    // When
    const result = await useCase.execute({ todoId: 1, userId: fixture.userId, itemIds: [3, 1, 2] });
    // Then
    expect(result.items.map((item) => [item.id, item.sortOrder])).toEqual([
      [3, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(fixture.records.get(1)?.items.map((item) => item.id)).toEqual([3, 1, 2]);
  });
  it.each([
    { name: "부분 ID", ids: [1], errorCode: ErrorCode.SYS_0002 },
    { name: "중복 ID", ids: [1, 1], errorCode: ErrorCode.SYS_0002 },
    { name: "다른 항목 ID", ids: [1, 999], errorCode: ErrorCode.TODO_0822 },
  ])("$name 요청은 순서를 변경하지 않는다", async ({ ids, errorCode }) => {
    // Given
    await fixture.todoRepository.createInlineItems(1, [
      { title: "첫 항목" },
      { title: "둘째 항목" },
    ]);
    const before = structuredClone(fixture.records.get(1));
    // When / Then
    await expect(
      useCase.execute({ todoId: 1, userId: fixture.userId, itemIds: ids }),
    ).rejects.toMatchObject({ errorCode });
    expect(fixture.records.get(1)).toEqual(before);
  });
  it("다른 사용자의 할 일은 재정렬하지 않는다", async () => {
    // Given / When / Then
    await expect(
      useCase.execute({ todoId: 1, userId: "other-user", itemIds: [] }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
  });
});
