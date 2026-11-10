import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning/planning-todos.fixture";

import { ChangeTodoCategoryUseCase } from "./change-todo-category.use-case.js";

describe("할 일 카테고리 이동", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: ChangeTodoCategoryUseCase;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new ChangeTodoCategoryUseCase(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("새 카테고리에 저장하고 응답과 카테고리 캐시를 갱신한다", async () => {
    // Given
    fixture.categories.set(2, { id: 2, name: "새 카테고리", color: "#123456", sortOrder: 1 });
    fixture.categoryOwners.set(2, fixture.userId);
    fixture.todoCache.categoryUsers.add(fixture.userId);
    // When
    const result = await useCase.execute({ id: 1, userId: fixture.userId, categoryId: 2 });
    // Then
    expect(fixture.records.get(1)?.categoryId).toBe(2);
    expect(result.category).toMatchObject({ id: 2, name: "새 카테고리" });
    expect(fixture.todoCache.categoryUsers.has(fixture.userId)).toBe(false);
    expect(fixture.eventPublisher.publishedEvents.map(({ eventName }) => eventName)).toEqual([
      "planning.todo.category-changed",
    ]);
  });
  it("활성 카테고리 한도는 거부하지만 완료된 할 일 이동은 허용한다", async () => {
    // Given
    fixture.categories.set(2, { id: 2, name: "대상", color: "#123456", sortOrder: 1 });
    fixture.categoryOwners.set(2, fixture.userId);
    for (let id = 2; id <= TODO_LIMITS.MAX_PER_CATEGORY + 1; id++) {
      fixture.records.set(id, { ...createPlanningTodo(fixture.userId, id), categoryId: 2 });
    }
    // When / Then
    await expect(
      useCase.execute({ id: 1, userId: fixture.userId, categoryId: 2 }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0811 });
    expect(fixture.records.get(1)?.categoryId).toBe(1);
    const saved = fixture.records.get(1);
    if (saved == null) {
      throw new Error("Todo fixture missing");
    }
    saved.completed = true;
    saved.completedAt = PLANNING_TIME;
    const result = await useCase.execute({ id: 1, userId: fixture.userId, categoryId: 2 });
    expect(result).toMatchObject({
      completed: true,
      completedAt: PLANNING_TIME.toISOString(),
      category: { id: 2 },
    });
  });
  it("다른 소유자의 카테고리와 없는 할 일은 기존 오류를 유지한다", async () => {
    // Given
    fixture.categoryOwners.set(1, "other-user");
    await expect(
      useCase.execute({ id: 999, userId: fixture.userId, categoryId: 1 }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0851 });
    // When / Then
    await expect(
      useCase.execute({ id: 1, userId: fixture.userId, categoryId: 1 }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0851 });
    fixture.categoryOwners.set(1, fixture.userId);
    await expect(
      useCase.execute({ id: 999, userId: fixture.userId, categoryId: 1 }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(fixture.records.get(1)?.categoryId).toBe(1);
  });
});
