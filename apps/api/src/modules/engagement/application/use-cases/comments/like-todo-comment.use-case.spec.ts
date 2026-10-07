import { vi } from "vitest";

import {
  createEngagementCommentFixture,
  ENGAGEMENT_TIME,
  ENGAGEMENT_OWNER_ID,
  ENGAGEMENT_VIEWER_ID,
} from "#test/fixtures/engagement-comment.fixture";

import { LikeTodoComment } from "./like-todo-comment.use-case.js";
import { UnlikeTodoComment } from "./unlike-todo-comment.use-case.js";

describe("LikeTodoComment — 댓글 사용자 상태", () => {
  let fixture: ReturnType<typeof createEngagementCommentFixture>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ENGAGEMENT_TIME);
    fixture = createEngagementCommentFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("좋아요를 저장하고 알림 성공 뒤 이력을 표시하며 원문은 알림 경계에 전달하지 않는다", async () => {
    // Given
    const comment = fixture.addComment({ content: "알림에 포함하면 안 되는 원문" });
    // When
    const result = await new LikeTodoComment(fixture).execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_VIEWER_ID,
    });
    // Then
    expect(result).toEqual({ commentId: comment.id, isLiked: true, likeCount: 1 });
    expect(fixture.repository.likes.get(`${comment.id}:${ENGAGEMENT_VIEWER_ID}`)).toEqual({
      isLiked: true,
      wasEverNotified: true,
    });
    expect(fixture.notification.liked).toEqual([
      {
        recipientId: ENGAGEMENT_OWNER_ID,
        senderId: ENGAGEMENT_VIEWER_ID,
        senderName: "방문자",
        todoId: 1,
        commentId: comment.id,
        threadRootId: comment.id,
      },
    ]);
  });
  it("알림이 대기하는 동안 완료 이력은 없고 성공 후 표시한다", async () => {
    // Given
    const comment = fixture.addComment();
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const notify = fixture.notification.notifyCommentLiked.bind(fixture.notification);
    vi.spyOn(fixture.notification, "notifyCommentLiked").mockImplementation(async (input) => {
      started.resolve();
      await finish.promise;
      return notify(input);
    });
    // When
    const outcome = new LikeTodoComment(fixture).execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_VIEWER_ID,
    });
    await started.promise;
    // Then
    try {
      expect(
        fixture.repository.likes.get(`${comment.id}:${ENGAGEMENT_VIEWER_ID}`)?.wasEverNotified,
      ).toBe(false);
    } finally {
      finish.resolve();
    }
    await outcome;
    expect(
      fixture.repository.likes.get(`${comment.id}:${ENGAGEMENT_VIEWER_ID}`)?.wasEverNotified,
    ).toBe(true);
  });
  it("알림 실패에도 좋아요는 유지하고 같은 요청을 재전송하면 미완료 알림만 다시 처리한다", async () => {
    // Given
    const comment = fixture.addComment();
    const notify = vi
      .spyOn(fixture.notification, "notifyCommentLiked")
      .mockRejectedValueOnce(new Error("private provider message"));
    const warning = vi.spyOn(fixture.logger, "warn");
    const useCase = new LikeTodoComment(fixture);
    // When
    const first = await useCase.execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_VIEWER_ID,
    });
    // Then
    expect(first).toEqual({ commentId: comment.id, isLiked: true, likeCount: 1 });
    expect(fixture.repository.likes.get(`${comment.id}:${ENGAGEMENT_VIEWER_ID}`)).toEqual({
      isLiked: true,
      wasEverNotified: false,
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private provider message");
    await useCase.execute({ todoId: 1, commentId: comment.id, userId: ENGAGEMENT_VIEWER_ID });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(fixture.notification.liked).toHaveLength(1);
    expect(fixture.repository.likeCounts.get(comment.id)).toBe(1);
    expect(
      fixture.repository.likes.get(`${comment.id}:${ENGAGEMENT_VIEWER_ID}`)?.wasEverNotified,
    ).toBe(true);
  });
  it("이미 알린 좋아요는 취소 후 재설정해도 다시 알리지 않는다", async () => {
    // Given
    const comment = fixture.addComment();
    const useCase = new LikeTodoComment(fixture);
    await useCase.execute({ todoId: 1, commentId: comment.id, userId: ENGAGEMENT_VIEWER_ID });
    // When
    await new UnlikeTodoComment(fixture).execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_VIEWER_ID,
    });
    await useCase.execute({ todoId: 1, commentId: comment.id, userId: ENGAGEMENT_VIEWER_ID });
    // Then
    expect(fixture.notification.liked).toHaveLength(1);
    expect(fixture.repository.likeCounts.get(comment.id)).toBe(1);
  });
  it("후속 처리 직전에 좋아요가 취소되면 fresh pending 상태를 확인해 알림을 보내지 않는다", async () => {
    // Given
    const comment = fixture.addComment();
    let unitOfWorkCalls = 0;
    fixture.unitOfWork.run = async (work) => {
      unitOfWorkCalls++;
      if (unitOfWorkCalls === 2)
        await fixture.repository.removeLike(1, comment.id, ENGAGEMENT_VIEWER_ID);
      return work();
    };
    // When
    await new LikeTodoComment(fixture).execute({
      todoId: 1,
      commentId: comment.id,
      userId: ENGAGEMENT_VIEWER_ID,
    });
    // Then
    expect(fixture.notification.liked).toEqual([]);
    expect(fixture.repository.likes.get(`${comment.id}:${ENGAGEMENT_VIEWER_ID}`)).toEqual({
      isLiked: false,
      wasEverNotified: false,
    });
  });
});
