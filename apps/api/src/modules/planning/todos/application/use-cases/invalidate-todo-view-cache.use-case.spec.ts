import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { InMemoryTodoReadRepository } from "#test/doubles/planning/in-memory-todo-read.repository";
import { createPlanningTodo } from "#test/fixtures/planning/planning-todos.fixture";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import { InvalidateTodoViewCacheUseCase } from "./invalidate-todo-view-cache.use-case.js";

function setUp() {
  const owned = createPlanningTodo("owner-1", 42);
  const cache = new FakeTodoCache();
  const invalidator = new InvalidateTodoViewCacheUseCase({
    todoReadRepository: new InMemoryTodoReadRepository(new Map([[42, owned]]), new Map()),
    cache,
  });
  return { cache, invalidator };
}

describe("InvalidateTodoViewCacheUseCase", () => {
  it("할 일의 소유자를 찾아 그 사람의 친구 목록 캐시를 버린다", async () => {
    // Given - 캐시 키는 소유자 기준이므로 todoId만으로는 지울 수 없다
    const { cache, invalidator } = setUp();

    // When
    await invalidator.execute(TodoId.reconstitute(42));

    // Then
    expect([...cache.generations]).toEqual([["owner-1", 1]]);
  });

  it("할 일이 사라졌으면 지울 캐시도 없다", async () => {
    // Given
    const { cache, invalidator } = setUp();

    // When
    await invalidator.execute(TodoId.reconstitute(7));

    // Then
    expect(cache.generations.size).toBe(0);
  });
});
