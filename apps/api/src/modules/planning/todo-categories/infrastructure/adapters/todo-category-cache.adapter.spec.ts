import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryWithCountReadModel } from "../../application/read-models/todo-category-with-count.read-model.js";
import { TodoCategoryCacheAdapter } from "./todo-category-cache.adapter.js";

function category(todoCount: number): TodoCategoryWithCountReadModel {
  return {
    id: 1,
    userId: "user-1",
    name: "업무",
    color: "#FF6B00",
    sortOrder: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    todoCount,
  };
}

describe("TodoCategoryCacheAdapter — 카테고리 목록 캐시", () => {
  it("목록을 읽는 동안 카테고리 쓰기가 커밋해 무효화되면 읽은 목록을 남기지 않는다", async () => {
    // Given
    const adapter = new TodoCategoryCacheAdapter(
      new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
    );
    const userId = UserId.reconstitute("user-1");
    const readBeforeCommit = async () => {
      await adapter.invalidate(userId);
      return [category(3)];
    };

    // When
    await adapter.wrapList(userId, readBeforeCommit);
    const next = await adapter.wrapList(userId, async () => [category(4)]);

    // Then
    expect(next).toEqual([category(4)]);
  });
});
