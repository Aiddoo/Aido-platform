import { DELETED_COMMENT_AUTHOR } from "#api/modules/engagement/comments/domain/comments.constants";
import {
  createTodoCommentLikeFixture,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_OWNER_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import {
  createTodoCommentsFixture,
  type TodoCommentsFixture,
} from "#test/fixtures/engagement/todo-comments.fixture";

import { TodoCommentLockKeys } from "../comments.lock-keys.js";
import { TodoCommentLogEvent } from "../comments.log-events.js";
import { CleanUpAccountTodoCommentsUseCase } from "./clean-up-account-todo-comments.use-case.js";
import { InvalidateCleanedTodoCachesUseCase } from "./invalidate-cleaned-todo-caches.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;

describe("CleanUpAccountTodoCommentsUseCase — 계정 정리 경계", () => {
  let fixture: TodoCommentsFixture;

  beforeEach(() => {
    fixture = createTodoCommentsFixture();
  });

  it("정리할 글을 모두 잠근 뒤 할 일 수를 잠그고, 묘비로 남긴 글을 빼고 다시 센 댓글 수를 planning에 넘긴다", async () => {
    // Given
    const head = await fixture.addComment({
      authorId: TODO_COMMENT_FIXTURE_FRIEND_ID,
      replyCount: 1,
    });
    const reply = await fixture.addComment({
      authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      parentId: head.id.value,
      replyToCommentId: head.id.value,
    });
    await fixture.likeRepository.save(createTodoCommentLikeFixture({ commentId: head.id.value }));

    // When
    const result = await new CleanUpAccountTodoCommentsUseCase(fixture).execute({
      userId: TODO_COMMENT_FIXTURE_VIEWER_ID,
    });

    // Then
    expect(result).toEqual({ affectedTodoIds: [TODO_ID] });
    expect(fixture.mutationLock.acquiredKeys).toEqual([
      [head.id.value, reply.id.value].toSorted().map(TodoCommentLockKeys.comment),
    ]);
    expect(fixture.engagementCounter.lockedTodoIds).toEqual([[TODO_ID]]);
    expect(fixture.engagementCounter.commentCounts.get(TODO_ID)).toBe(1);
    const stored = new Map(fixture.repository.list().map((comment) => [comment.id.value, comment]));
    expect(stored.get(reply.id.value)?.toPrimitives()).toMatchObject({
      authorId: DELETED_COMMENT_AUTHOR.id,
      content: null,
      requestFingerprint: null,
    });
    expect(stored.get(head.id.value)?.replyCount).toBe(0);
    expect(fixture.likeRepository.list()).toEqual([]);
  });

  it("정리할 글이 없으면 잠그지 않고 할 일 수도 건드리지 않는다", async () => {
    // Given
    await fixture.addComment({ authorId: TODO_COMMENT_FIXTURE_OWNER_ID });

    // When
    const result = await new CleanUpAccountTodoCommentsUseCase(fixture).execute({
      userId: TODO_COMMENT_FIXTURE_VIEWER_ID,
    });

    // Then
    expect(result).toEqual({ affectedTodoIds: [] });
    expect(fixture.mutationLock.acquiredKeys).toEqual([]);
    expect(fixture.engagementCounter.lockedTodoIds).toEqual([]);
  });
});

describe("InvalidateCleanedTodoCachesUseCase — 계정 정리 뒤 캐시", () => {
  it("첫 캐시 정리가 실패해도 나머지 할 일을 정리하고 오류 원문을 로그에 남기지 않는다", async () => {
    // Given
    const fixture = createTodoCommentsFixture();
    fixture.todoViewCache.failures.set(8, new Error("private cache failure"));

    // When
    await new InvalidateCleanedTodoCachesUseCase(fixture).execute({ todoIds: [8, 13] });

    // Then
    expect(fixture.todoViewCache.invalidatedTodoIds).toEqual([13]);
    expect(fixture.logger.messages).toEqual([
      expect.objectContaining({
        event: TodoCommentLogEvent.ACCOUNT_CLEANUP_CACHE_INVALIDATION_FAILED,
        todoId: 8,
      }),
    ]);
    expect(JSON.stringify(fixture.logger.messages)).not.toContain("private cache failure");
  });
});
