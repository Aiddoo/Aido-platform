import { vi } from "vitest";

import {
  createEngagementCommentFixture,
  ENGAGEMENT_TIME,
  ENGAGEMENT_OWNER_ID,
} from "#test/fixtures/engagement-comment.fixture";

import type { TodoCommentAccountCleanupStorePort } from "../../ports/comments/todo-comment-account-cleanup.store.port.js";
import { TodoCommentAccountCleanup } from "./todo-comment-account-cleanup.service.js";

describe("TodoCommentAccountCleanup — 계정 정리 경계", () => {
  let fixture: ReturnType<typeof createEngagementCommentFixture>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ENGAGEMENT_TIME);
    fixture = createEngagementCommentFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("정리 대상 잠금이 끝난 뒤 Store에 동일 계획을 전달하고 영향받은 Todo를 반환한다", async () => {
    // Given
    const comment = fixture.addComment();
    const plan = { affectedTodoIds: [8, 13], commentIdsToLock: [comment.id] };
    const lockKeys: string[] = [];
    fixture.mutationLock.acquire = async (keys) => {
      lockKeys.push(...keys);
    };
    let cleanedUserId: string | undefined;
    const store: TodoCommentAccountCleanupStorePort = {
      async plan(_userId) {
        return structuredClone(plan);
      },
      async cleanup(userId, cleanupPlan) {
        expect(lockKeys).toEqual([`mutation:v1:todo-comment:${comment.id}`]);
        expect(cleanupPlan).toEqual(plan);
        cleanedUserId = userId;
      },
    };
    // When
    const result = await new TodoCommentAccountCleanup({ ...fixture, store }).cleanupInTransaction(
      ENGAGEMENT_OWNER_ID,
    );
    // Then
    expect(cleanedUserId).toBe(ENGAGEMENT_OWNER_ID);
    expect(result).toEqual({ affectedTodoIds: [8, 13] });
  });

  it("정리 대상 댓글이 없어도 사용자 참조 최종 확인을 실행하고 잠금은 요청하지 않는다", async () => {
    // Given
    const lock = vi.spyOn(fixture.mutationLock, "acquire");
    let cleaned = false;
    const store: TodoCommentAccountCleanupStorePort = {
      async plan() {
        return { affectedTodoIds: [], commentIdsToLock: [] };
      },
      async cleanup() {
        cleaned = true;
      },
    };
    // When
    const result = await new TodoCommentAccountCleanup({ ...fixture, store }).cleanupInTransaction(
      ENGAGEMENT_OWNER_ID,
    );
    // Then
    expect(cleaned).toBe(true);
    expect(result.affectedTodoIds).toEqual([]);
    expect(lock).not.toHaveBeenCalled();
  });

  it("첫 캐시 정리가 실패해도 나머지 Todo를 정리하고 완료된 계정 삭제를 실패로 바꾸지 않는다", async () => {
    // Given
    const invalidate = fixture.todoViewCache.invalidateForTodo.bind(fixture.todoViewCache);
    vi.spyOn(fixture.todoViewCache, "invalidateForTodo").mockImplementation(async (todoId) => {
      if (todoId === 8) throw new Error("private cache failure");
      return invalidate(todoId);
    });
    const warning = vi.spyOn(fixture.logger, "warn");
    const store: TodoCommentAccountCleanupStorePort = {
      async plan() {
        return { affectedTodoIds: [], commentIdsToLock: [] };
      },
      async cleanup() {},
    };
    const cleanup = new TodoCommentAccountCleanup({ ...fixture, store });
    // When / Then
    await expect(cleanup.settleAfterCommit({ affectedTodoIds: [8, 13] })).resolves.toBeUndefined();
    expect(fixture.invalidatedTodoIds).toEqual([13]);
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private cache failure");
  });
});
