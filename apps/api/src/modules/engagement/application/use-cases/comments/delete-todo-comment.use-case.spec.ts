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

  it("댓글과 조상을 잠근 뒤 원문을 지우고 반복 삭제는 counter·캐시를 다시 변경하지 않는다", async () => {
    // Given
    const root = fixture.addComment();
    const parent = fixture.addComment({ parentId: root.id, rootId: root.id, path: [root.id] });
    const comment = fixture.addComment({
      parentId: parent.id,
      rootId: root.id,
      path: [root.id, parent.id],
    });
    const lock = vi.spyOn(fixture.mutationLock, "acquire");
    const useCase = new DeleteTodoComment(fixture);
    // When
    const result = await useCase.execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_OWNER_ID,
    });
    vi.setSystemTime(new Date(ENGAGEMENT_TIME.getTime() + 1000));
    await useCase.execute({ todoId: 1, commentId: comment.id, userId: ENGAGEMENT_OWNER_ID });
    // Then
    expect(result).toEqual({ commentId: comment.id, isDeleted: true });
    expect(fixture.repository.comments.get(comment.id)).toMatchObject({
      content: null,
      deletedAt: ENGAGEMENT_TIME,
    });
    expect(fixture.repository.commentCounts.get(1)).toBe(2);
    expect(fixture.repository.ancestorSettlements).toEqual([
      { commentId: comment.id, path: [root.id, parent.id] },
    ]);
    expect(fixture.invalidatedTodoIds).toEqual([1]);
    expect(lock).toHaveBeenCalledWith([
      MutationLockKeys.todoComment(comment.id),
      MutationLockKeys.todoComment(root.id),
      MutationLockKeys.todoComment(parent.id),
    ]);
  });
  it("다른 작성자의 삭제는 TODO_0832로 거부하고 count와 원문을 유지한다", async () => {
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
