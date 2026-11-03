import { vi } from "vitest";

import { MutationLockKeys } from "#api/shared/application/ports/index";
import {
  createEngagementCommentFixture,
  ENGAGEMENT_TIME,
  ENGAGEMENT_OWNER_ID,
  ENGAGEMENT_VIEWER_ID,
} from "#test/fixtures/engagement-comment.fixture";

import { DeleteTodoComment } from "./delete-todo-comment.use-case.js";

describe("DeleteTodoComment — 댓글 사용자 상태", () => {
  let fixture: ReturnType<typeof createEngagementCommentFixture>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ENGAGEMENT_TIME);
    fixture = createEngagementCommentFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("답글과 묶음 머리만 잠근 뒤 원문을 지우고 머리의 답글 수를 1 내리며 반복 삭제는 다시 바꾸지 않는다", async () => {
    // Given
    const comment = fixture.addComment({ replyCount: 2 });
    fixture.addComment({ parentId: comment.id, replyToCommentId: comment.id });
    const reply = fixture.addComment({ parentId: comment.id, replyToCommentId: comment.id });
    const lock = vi.spyOn(fixture.mutationLock, "acquire");
    const useCase = new DeleteTodoComment(fixture);

    // When
    const result = await useCase.execute({
      todoId: 1,
      commentId: reply.id,
      userId: ENGAGEMENT_OWNER_ID,
    });
    vi.setSystemTime(new Date(ENGAGEMENT_TIME.getTime() + 1000));
    await useCase.execute({ todoId: 1, commentId: reply.id, userId: ENGAGEMENT_OWNER_ID });

    // Then
    expect(result).toEqual({ commentId: reply.id, isDeleted: true });
    expect(fixture.repository.comments.get(reply.id)).toMatchObject({
      content: null,
      deletedAt: ENGAGEMENT_TIME,
    });
    expect(fixture.repository.comments.get(comment.id)?.replyCount).toBe(1);
    expect(fixture.repository.commentCounts.get(1)).toBe(2);
    expect(fixture.invalidatedTodoIds).toEqual([1]);
    expect(lock).toHaveBeenCalledWith([
      MutationLockKeys.todoComment(reply.id),
      MutationLockKeys.todoComment(comment.id),
    ]);
  });

  it("답글이 남은 댓글을 지우면 답글 수를 그대로 두어 묘비로 남긴다", async () => {
    // Given
    const comment = fixture.addComment({ replyCount: 1 });
    fixture.addComment({ parentId: comment.id, replyToCommentId: comment.id });
    const lock = vi.spyOn(fixture.mutationLock, "acquire");

    // When
    await new DeleteTodoComment(fixture).execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_OWNER_ID,
    });

    // Then
    expect(fixture.repository.comments.get(comment.id)).toMatchObject({
      content: null,
      deletedAt: ENGAGEMENT_TIME,
      replyCount: 1,
    });
    expect(lock).toHaveBeenCalledWith([MutationLockKeys.todoComment(comment.id)]);
  });

  it("할 일 주인은 자기 할 일에 친구가 단 댓글을 모두에게서 지운다", async () => {
    // Given
    const comment = fixture.addComment({ authorId: ENGAGEMENT_VIEWER_ID });
    // When
    const result = await new DeleteTodoComment(fixture).execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_OWNER_ID,
    });
    // Then
    expect(result).toEqual({ commentId: comment.id, isDeleted: true });
    expect(fixture.repository.comments.get(comment.id)).toMatchObject({
      content: null,
      deletedAt: ENGAGEMENT_TIME,
    });
    expect(fixture.repository.commentCounts.get(1)).toBe(0);
    expect(fixture.invalidatedTodoIds).toEqual([1]);
  });
  it("작성자도 할 일 주인도 아닌 사람의 삭제는 TODO_0832로 거부하고 count와 원문을 유지한다", async () => {
    // Given
    const comment = fixture.addComment();
    // When / Then
    await expect(
      new DeleteTodoComment(fixture).execute({
        todoId: 1,
        commentId: comment.id,
        userId: ENGAGEMENT_VIEWER_ID,
      }),
    ).rejects.toMatchObject({ errorCode: "TODO_0832" });
    expect(fixture.repository.comments.get(comment.id)).toEqual(comment);
    expect(fixture.repository.commentCounts.get(1)).toBe(1);
    expect(fixture.invalidatedTodoIds).toEqual([]);
  });
});
