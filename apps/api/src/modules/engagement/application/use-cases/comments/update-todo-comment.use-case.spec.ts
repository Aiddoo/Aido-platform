import { vi } from "vitest";

import {
  createEngagementCommentFixture,
  ENGAGEMENT_TIME,
  ENGAGEMENT_OWNER_ID,
  ENGAGEMENT_VIEWER_ID,
} from "#test/fixtures/engagement-comment.fixture";

import { UpdateTodoComment } from "./update-todo-comment.use-case.js";

describe("UpdateTodoComment — 댓글 사용자 상태", () => {
  let fixture: ReturnType<typeof createEngagementCommentFixture>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ENGAGEMENT_TIME);
    fixture = createEngagementCommentFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("작성자는 댓글을 수정하고 viewer 좋아요·작성 시각을 보존한다", async () => {
    // Given
    const comment = fixture.addComment();
    fixture.repository.likes.set(`${comment.id}:${ENGAGEMENT_OWNER_ID}`, {
      isLiked: true,
      wasEverNotified: true,
    });
    vi.setSystemTime(new Date(ENGAGEMENT_TIME.getTime() + 1000));
    // When
    const result = await new UpdateTodoComment(fixture).execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_OWNER_ID,
      content: "  수정 내용  ",
    });
    // Then
    expect(fixture.repository.comments.get(comment.id)).toMatchObject({
      content: "수정 내용",
      createdAt: ENGAGEMENT_TIME,
      editedAt: new Date(ENGAGEMENT_TIME.getTime() + 1000),
    });
    expect(result.comment).toMatchObject({ content: "수정 내용", viewer: { isLiked: true } });
  });
  it("다른 작성자의 수정은 TODO_0832로 거부하고 원문을 유지한다", async () => {
    // Given
    const comment = fixture.addComment();
    // When / Then
    await expect(
      new UpdateTodoComment(fixture).execute({
        todoId: 1,
        commentId: comment.id,
        userId: ENGAGEMENT_VIEWER_ID,
        content: "수정",
      }),
    ).rejects.toMatchObject({ errorCode: "TODO_0832" });
    expect(fixture.repository.comments.get(comment.id)).toEqual(comment);
  });
  it("접근을 잃은 사용자는 댓글 부재보다 TODO_0801을 우선한다", async () => {
    // Given
    fixture.reader.accessiblePairs.delete(`1:${ENGAGEMENT_VIEWER_ID}`);
    // When / Then
    await expect(
      new UpdateTodoComment(fixture).execute({
        todoId: 1,
        commentId: "missing",
        userId: ENGAGEMENT_VIEWER_ID,
        content: "수정",
      }),
    ).rejects.toMatchObject({ errorCode: "TODO_0801" });
    expect(fixture.repository.comments.size).toBe(0);
  });
});
