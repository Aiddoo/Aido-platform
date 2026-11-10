import { ErrorCode } from "@aido/api/errors";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
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
import { DeleteTodoCommentUseCase } from "./delete-todo-comment.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;

describe("DeleteTodoCommentUseCase — 댓글 삭제", () => {
  let fixture: TodoCommentsFixture;

  beforeEach(() => {
    fixture = createTodoCommentsFixture();
  });

  it("답글과 묶음 머리만 잠근 뒤 원문을 지우고 머리 답글 수를 1 내리며, 다시 지워도 바꾸지 않는다", async () => {
    // Given
    const head = await fixture.addComment({ replyCount: 2 });
    await fixture.addComment({ parentId: head.id.value, replyToCommentId: head.id.value });
    const reply = await fixture.addComment({
      parentId: head.id.value,
      replyToCommentId: head.id.value,
      likeCount: 1,
    });
    await fixture.likeRepository.save(createTodoCommentLikeFixture({ commentId: reply.id.value }));
    const useCase = new DeleteTodoCommentUseCase(fixture);
    const command = {
      todoId: TODO_ID,
      commentId: reply.id.value,
      userId: TODO_COMMENT_FIXTURE_OWNER_ID,
    };

    // When
    await useCase.execute(command);
    fixture.clock.advanceBy({ minutes: 1 });
    await useCase.execute(command);

    // Then
    const stored = await fixture.repository.findByIdAndTodoId(
      reply.id,
      TodoId.reconstitute(TODO_ID),
    );
    expect(stored?.toPrimitives()).toMatchObject({
      content: null,
      likeCount: 0,
      deletedAt: fixture.clock.now().subtract({ minutes: 1 }),
    });
    expect(
      (await fixture.repository.findByIdAndTodoId(head.id, TodoId.reconstitute(TODO_ID)))
        ?.replyCount,
    ).toBe(1);
    expect(fixture.likeRepository.list().map((like) => like.isActive)).toEqual([false]);
    expect(fixture.engagementCounter.commentCounts.get(TODO_ID)).toBe(2);
    expect(fixture.todoViewCache.invalidatedTodoIds).toEqual([TODO_ID]);
    expect(fixture.mutationLock.acquiredKeys.at(0)).toEqual([
      TodoCommentLockKeys.comment(reply.id.value),
      TodoCommentLockKeys.comment(head.id.value),
    ]);
  });

  it("답글이 남은 댓글을 지우면 답글 수를 그대로 두어 묘비로 남긴다", async () => {
    // Given
    const head = await fixture.addComment({ replyCount: 1 });
    await fixture.addComment({ parentId: head.id.value, replyToCommentId: head.id.value });

    // When
    await new DeleteTodoCommentUseCase(fixture).execute({
      todoId: TODO_ID,
      commentId: head.id.value,
      userId: TODO_COMMENT_FIXTURE_OWNER_ID,
    });

    // Then
    const stored = await fixture.repository.findByIdAndTodoId(
      head.id,
      TodoId.reconstitute(TODO_ID),
    );
    expect({ isDeleted: stored?.isDeleted, replyCount: stored?.replyCount }).toEqual({
      isDeleted: true,
      replyCount: 1,
    });
    expect(fixture.mutationLock.acquiredKeys).toEqual([
      [TodoCommentLockKeys.comment(head.id.value)],
    ]);
  });

  it("할 일 주인은 자기 할 일에 친구가 단 댓글을 모두에게서 지운다", async () => {
    // Given
    const comment = await fixture.addComment({ authorId: TODO_COMMENT_FIXTURE_FRIEND_ID });

    // When
    await new DeleteTodoCommentUseCase(fixture).execute({
      todoId: TODO_ID,
      commentId: comment.id.value,
      userId: TODO_COMMENT_FIXTURE_OWNER_ID,
    });

    // Then
    expect(
      (await fixture.repository.findByIdAndTodoId(comment.id, TodoId.reconstitute(TODO_ID)))
        ?.isDeleted,
    ).toBe(true);
  });

  it("작성자도 할 일 주인도 아닌 사람의 삭제는 TODO_0832로 거부하고 수와 원문을 둔다", async () => {
    // Given
    const comment = await fixture.addComment({ authorId: TODO_COMMENT_FIXTURE_FRIEND_ID });

    // When
    const deleting = new DeleteTodoCommentUseCase(fixture).execute({
      todoId: TODO_ID,
      commentId: comment.id.value,
      userId: TODO_COMMENT_FIXTURE_VIEWER_ID,
    });

    // Then
    await expect(deleting).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0832 });
    expect(
      (await fixture.repository.findByIdAndTodoId(comment.id, TodoId.reconstitute(TODO_ID)))
        ?.content,
    ).toBe("댓글 원문");
    expect(fixture.engagementCounter.commentCounts.get(TODO_ID)).toBe(1);
  });

  it("할 일 댓글 수가 이미 0이면 SYS_0003으로 거부한다", async () => {
    // Given
    const comment = await fixture.addComment();
    await fixture.engagementCounter.decrementCommentCount(TODO_ID);

    // When
    const deleting = new DeleteTodoCommentUseCase(fixture).execute({
      todoId: TODO_ID,
      commentId: comment.id.value,
      userId: TODO_COMMENT_FIXTURE_OWNER_ID,
    });

    // Then
    await expect(deleting).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0003,
      details: { commentId: comment.id.value },
    });
  });
});
