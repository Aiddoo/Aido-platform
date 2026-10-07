import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type MutationLockPort } from "#api/shared/application/ports/index";

import { type TodoCommentAccountCleanupStorePort } from "../../ports/comments/todo-comment-account-cleanup.store.port.js";
import { type TodoViewCachePort } from "../../ports/comments/todo-view-cache.port.js";
import { TodoCommentAccountCleanup } from "./todo-comment-account-cleanup.js";

function createCleanupStoreMock(): TodoCommentAccountCleanupStorePort {
  return {
    plan: vi.fn(),
    cleanup: vi.fn(),
  };
}

function createTodoViewCacheMock(): TodoViewCachePort {
  return { invalidateForTodo: vi.fn() };
}

function createMutationLockMock(): MutationLockPort {
  return { acquire: vi.fn() };
}

describe("TodoCommentAccountCleanup", () => {
  let cleanup: TodoCommentAccountCleanup;
  let store: Mocked<TodoCommentAccountCleanupStorePort>;
  let todoViewCache: Mocked<TodoViewCachePort>;
  let mutationLock: Mocked<MutationLockPort>;

  beforeEach(async () => {
    const todoCommentAccountCleanupDependencies = mockDeep<
      ConstructorParameters<typeof TodoCommentAccountCleanup>[0]
    >({
      store: createCleanupStoreMock(),
      todoViewCache: createTodoViewCacheMock(),
      mutationLock: createMutationLockMock(),
    });
    const unit = new TodoCommentAccountCleanup(todoCommentAccountCleanupDependencies);

    cleanup = unit;
    store = todoCommentAccountCleanupDependencies.store;
    todoViewCache = todoCommentAccountCleanupDependencies.todoViewCache;
    mutationLock = todoCommentAccountCleanupDependencies.mutationLock;
  });

  it("정리 대상 댓글을 잠근 뒤 같은 UoW에서 묘비와 counter를 정산한다", async () => {
    // Given
    store.plan.mockResolvedValue({
      affectedTodoIds: [8, 13],
      commentIdsToLock: ["comment-1", "comment-2"],
    });

    // When
    const result = await cleanup.cleanupInTransaction("user-1");

    // Then
    expect(mutationLock.acquire).toHaveBeenCalledWith([
      "mutation:v1:todo-comment:comment-1",
      "mutation:v1:todo-comment:comment-2",
    ]);
    expect(store.cleanup).toHaveBeenCalledWith("user-1", {
      affectedTodoIds: [8, 13],
      commentIdsToLock: ["comment-1", "comment-2"],
    });
    expect(mutationLock.acquire.mock.invocationCallOrder[0]).toBeLessThan(
      store.cleanup.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(result).toEqual({ affectedTodoIds: [8, 13] });
  });

  it("정리 대상 댓글이 없어도 store가 사용자 참조를 최종 확인한다", async () => {
    // Given
    store.plan.mockResolvedValue({ affectedTodoIds: [], commentIdsToLock: [] });

    // When
    await cleanup.cleanupInTransaction("user-1");

    // Then
    expect(mutationLock.acquire).not.toHaveBeenCalled();
    expect(store.cleanup).toHaveBeenCalledWith("user-1", {
      affectedTodoIds: [],
      commentIdsToLock: [],
    });
  });

  it("커밋 뒤 todo cache 정리가 실패해도 완료된 계정 삭제를 실패로 바꾸지 않는다", async () => {
    // Given
    todoViewCache.invalidateForTodo.mockRejectedValueOnce(new Error("cache unavailable"));

    // When / Then
    await expect(cleanup.settleAfterCommit({ affectedTodoIds: [8, 13] })).resolves.toBeUndefined();
    expect(todoViewCache.invalidateForTodo).toHaveBeenCalledTimes(2);
    expect(todoViewCache.invalidateForTodo).toHaveBeenNthCalledWith(1, 8);
    expect(todoViewCache.invalidateForTodo).toHaveBeenNthCalledWith(2, 13);
  });
});
