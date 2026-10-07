import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { AddTodoItem } from "./add-todo-item.use-case.js";

describe("하위 항목 추가", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: AddTodoItem;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new AddTodoItem(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("항목 제목과 다음 순서를 저장하고 실제 항목 통계를 반환한다", async () => {
    // Given
    await fixture.todoRepository.createItem(1, { title: "기존 항목", sortOrder: 0 });
    // When
    const result = await useCase.execute({ todoId: 1, userId: fixture.userId, title: "추가 항목" });
    // Then
    expect(result.items.map((item) => ({ title: item.title, sortOrder: item.sortOrder }))).toEqual([
      { title: "기존 항목", sortOrder: 0 },
      { title: "추가 항목", sortOrder: 1 },
    ]);
    expect(result.itemStats).toEqual({ total: 2, completed: 0 });
    expect(fixture.records.get(1)?.items).toHaveLength(2);
  });
  it("20개 항목 한도와 잘못된 제목은 상태를 바꾸지 않는다", async () => {
    // Given
    for (let sortOrder = 0; sortOrder < TODO_ITEM_LIMITS.MAX_PER_TODO; sortOrder++)
      await fixture.todoRepository.createItem(1, { title: `항목 ${sortOrder}`, sortOrder });
    const before = structuredClone(fixture.records.get(1));
    // When / Then
    await expect(
      useCase.execute({ todoId: 1, userId: fixture.userId, title: "초과 항목" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0821 });
    expect(fixture.records.get(1)).toEqual(before);
    await expect(
      useCase.execute({ todoId: 999, userId: fixture.userId, title: "항목" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
  });
  it("잘못된 항목 제목을 거부하고 소유자만 항목을 추가할 수 있다", async () => {
    // Given
    const before = structuredClone(fixture.records.get(1));
    // When / Then
    await expect(
      useCase.execute({ todoId: 1, userId: fixture.userId, title: "가".repeat(201) }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    await expect(
      useCase.execute({ todoId: 1, userId: "other-user", title: "항목" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(fixture.records.get(1)).toEqual(before);
  });
});
