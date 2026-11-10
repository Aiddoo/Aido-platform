import { vi } from "vitest";

import {
  createEngagementCommentFixture,
  ENGAGEMENT_TIME,
  ENGAGEMENT_VIEWER_ID,
} from "#test/fixtures/engagement-comment.fixture";

import { UnlikeTodoComment } from "./unlike-todo-comment.use-case.js";

describe("UnlikeTodoComment — 댓글 사용자 상태", () => {
  let fixture: ReturnType<typeof createEngagementCommentFixture>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ENGAGEMENT_TIME);
    fixture = createEngagementCommentFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("좋아요를 취소하고 반복 취소도 count 0과 알림 이력을 보존한다", async () => {
    // Given
    const comment = fixture.addComment();
    fixture.repository.likes.set(`${comment.id}:${ENGAGEMENT_VIEWER_ID}`, {
      isLiked: true,
      wasEverNotified: true,
    });
    fixture.repository.likeCounts.set(comment.id, 1);
    const useCase = new UnlikeTodoComment(fixture);
    // When
    await useCase.execute({ todoId: 1, commentId: comment.id, userId: ENGAGEMENT_VIEWER_ID });
    const result = await useCase.execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_VIEWER_ID,
    });
    // Then
    expect(result).toEqual({ commentId: comment.id, isLiked: false, likeCount: 0 });
    expect(fixture.repository.likes.get(`${comment.id}:${ENGAGEMENT_VIEWER_ID}`)).toEqual({
      isLiked: false,
      wasEverNotified: true,
    });
    expect(fixture.repository.likeCounts.get(comment.id)).toBe(0);
  });
  it("삭제된 댓글은 TODO_0833으로 거부하고 좋아요를 변경하지 않는다", async () => {
    // Given
    const comment = fixture.addComment({ deletedAt: ENGAGEMENT_TIME, content: null });
    // When / Then
    await expect(
      new UnlikeTodoComment(fixture).execute({
        todoId: 1,
        commentId: comment.id,
        userId: ENGAGEMENT_VIEWER_ID,
      }),
    ).rejects.toMatchObject({ errorCode: "TODO_0833" });
    expect(fixture.repository.likes.size).toBe(0);
  });
});
