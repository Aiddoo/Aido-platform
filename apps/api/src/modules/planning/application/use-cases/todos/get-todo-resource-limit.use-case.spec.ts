import { TODO_LIMITS } from "@aido/api/vocabulary";
import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createTodoReadRepositoryMock } from "#test/mocks/ports/index";

import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { GetTodoResourceLimit } from "./get-todo-resource-limit.use-case.js";

describe("GetTodoResourceLimit — 카테고리 활성 Todo 리소스 제한 조회", () => {
  let useCase: GetTodoResourceLimit;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;

  beforeEach(async () => {
    const getTodoResourceLimitDependencies = mockDeep<
      ConstructorParameters<typeof GetTodoResourceLimit>[0]
    >({ todoReadRepository: createTodoReadRepositoryMock() });
    const unit = new GetTodoResourceLimit(getTodoResourceLimitDependencies);

    useCase = unit;
    todoReadRepository = getTodoResourceLimitDependencies.todoReadRepository;
  });

  it("categoryId가 있으면 활성 개수를 조회해 상한과 함께 반환한다", async () => {
    // Given
    todoReadRepository.countActiveByCategory.mockResolvedValue(12);

    // When
    const result = await useCase.execute({ userId: "user-123", categoryId: 3 });

    // Then
    expect(todoReadRepository.countActiveByCategory).toHaveBeenCalledWith("user-123", 3);
    expect(result).toEqual({
      activeCount: 12,
      maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
    });
  });

  it("categoryId가 없으면 활성 개수를 조회하지 않고 상한만 반환한다", async () => {
    // When
    const result = await useCase.execute({ userId: "user-123" });

    // Then - activeCount는 생략(undefined)
    expect(todoReadRepository.countActiveByCategory).not.toHaveBeenCalled();
    expect(result).toEqual({ maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY });
    expect(result.activeCount).toBeUndefined();
  });

  it("categoryId가 0이면(falsy) 상한만 반환하는 경로를 탄다 (경계값)", async () => {
    // When
    const result = await useCase.execute({ userId: "user-123", categoryId: 0 });

    // Then
    expect(todoReadRepository.countActiveByCategory).not.toHaveBeenCalled();
    expect(result).toEqual({ maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY });
  });
});
