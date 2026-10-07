import { TODO_LIMITS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { GetTodoResourceLimit } from "./get-todo-resource-limit.use-case.js";

describe("할 일 리소스 한도 조회", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: GetTodoResourceLimit;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new GetTodoResourceLimit(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("소유자의 미완료 개수만 활성 한도에 포함한다", async () => {
    // Given
    fixture.records.set(2, {
      ...createPlanningTodo(fixture.userId, 2),
      completed: true,
      completedAt: PLANNING_TIME,
    });
    fixture.records.set(3, createPlanningTodo("other-user", 3));
    // When
    const result = await useCase.execute({ userId: fixture.userId, categoryId: 1 });
    // Then
    expect(result).toEqual({ activeCount: 1, maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY });
  });
  it("카테고리를 생략하면 공통 최대 한도만 반환한다", async () => {
    // Given / When
    const result = await useCase.execute({ userId: fixture.userId });
    // Then
    expect(result).toEqual({ maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY });
  });
});
