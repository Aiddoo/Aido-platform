import { ErrorCode } from "@aido/api/errors";

import { TodoCommentId } from "#api/modules/engagement/comments/domain/todo-comment-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import {
  createTodoCommentsFixture,
  type TodoCommentsFixture,
} from "#test/fixtures/engagement/todo-comments.fixture";

import { TodoCommentLogEvent } from "../comments.log-events.js";
import { LikeTodoCommentUseCase } from "./like-todo-comment.use-case.js";
import { UnlikeTodoCommentUseCase } from "./unlike-todo-comment.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;
const LIKER = UserId.reconstitute(TODO_COMMENT_FIXTURE_VIEWER_ID);

describe("LikeTodoCommentUseCase·UnlikeTodoCommentUseCase — 댓글 좋아요", () => {
  let fixture: TodoCommentsFixture;

  beforeEach(() => {
    fixture = createTodoCommentsFixture();
  });

  function command(commentId: TodoCommentId) {
    return { todoId: TODO_ID, commentId: commentId.value, userId: TODO_COMMENT_FIXTURE_VIEWER_ID };
  }

  async function storedLike(commentId: TodoCommentId) {
    return fixture.likeRepository.findByCommentIdAndUserId(commentId, LIKER);
  }

  it("좋아요를 저장하고 알림을 보낸 뒤 알림 이력을 남기며 다시 눌러도 수를 늘리지 않는다", async () => {
    // Given
    const comment = await fixture.addComment();
    const useCase = new LikeTodoCommentUseCase(fixture);

    // When
    const first = await useCase.execute(command(comment.id));
    const again = await useCase.execute(command(comment.id));

    // Then
    expect([first, again]).toEqual([
      { commentId: comment.id.value, isLiked: true, likeCount: 1 },
      { commentId: comment.id.value, isLiked: true, likeCount: 1 },
    ]);
    expect((await storedLike(comment.id))?.wasEverNotified).toBe(true);
    expect(fixture.notification.liked).toEqual([
      {
        recipientId: comment.authorId.value,
        senderId: TODO_COMMENT_FIXTURE_VIEWER_ID,
        senderName: "방문자",
        todoId: TODO_ID,
        commentId: comment.id.value,
        threadRootId: comment.id.value,
      },
    ]);
  });

  it("차단 관계인 작성자의 글에는 좋아요를 남기지 않는다", async () => {
    // Given
    const comment = await fixture.addComment({ authorId: TODO_COMMENT_FIXTURE_FRIEND_ID });
    fixture.blockReader.block(TODO_COMMENT_FIXTURE_VIEWER_ID, TODO_COMMENT_FIXTURE_FRIEND_ID);

    // When
    const liking = new LikeTodoCommentUseCase(fixture).execute(command(comment.id));

    // Then
    await expect(liking).rejects.toMatchObject({ errorCode: ErrorCode.BLOCK_2204 });
    expect(await storedLike(comment.id)).toBeNull();
  });

  it("알림이 실패해도 좋아요를 두고, 같은 요청을 다시 보내면 남은 알림만 보낸다", async () => {
    // Given
    const comment = await fixture.addComment();
    const useCase = new LikeTodoCommentUseCase(fixture);
    fixture.notification.failure = new Error("push failure");

    // When
    const failed = await useCase.execute(command(comment.id));
    const pendingAfterFailure = (await storedLike(comment.id))?.isNotificationPending;
    await useCase.execute(command(comment.id));

    // Then
    expect(failed.likeCount).toBe(1);
    expect(pendingAfterFailure).toBe(true);
    expect(fixture.notification.liked).toHaveLength(1);
    expect(fixture.logger.messages).toEqual([
      expect.objectContaining({ event: TodoCommentLogEvent.LIKE_NOTIFICATION_FAILED }),
    ]);
  });

  it("이미 알린 좋아요는 취소한 뒤 다시 눌러도 알리지 않는다", async () => {
    // Given
    const comment = await fixture.addComment();
    const like = new LikeTodoCommentUseCase(fixture);
    const unlike = new UnlikeTodoCommentUseCase(fixture);
    await like.execute(command(comment.id));

    // When
    const cancelled = await unlike.execute(command(comment.id));
    const cancelledAgain = await unlike.execute(command(comment.id));
    const relike = await like.execute(command(comment.id));

    // Then
    expect([cancelled.likeCount, cancelledAgain.likeCount, relike.likeCount]).toEqual([0, 0, 1]);
    expect(fixture.notification.liked).toHaveLength(1);
  });

  it("지운 글의 좋아요 취소는 TODO_0833으로 거부한다", async () => {
    // Given
    const comment = await fixture.addComment({
      content: null,
      deletedAt: Temporal.Instant.from("2026-08-26T00:10:00Z"),
    });

    // When
    const unliking = new UnlikeTodoCommentUseCase(fixture).execute(command(comment.id));

    // Then
    await expect(unliking).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0833 });
  });
});
