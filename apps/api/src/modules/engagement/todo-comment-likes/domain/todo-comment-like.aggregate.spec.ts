import { createTodoCommentLikeFixture } from "#test/fixtures/engagement/todo-comment-like.fixture";
import { TODO_COMMENT_FIXTURE_NOW } from "#test/fixtures/engagement/todo-comment.fixture";

const LATER = TODO_COMMENT_FIXTURE_NOW.add({ minutes: 5 });

describe("TodoCommentLike — 좋아요 Aggregate", () => {
  it("켜진 좋아요를 다시 켜거나 꺼진 좋아요를 다시 끄면 false이고 바꾸지 않는다", () => {
    // Given
    const active = createTodoCommentLikeFixture();
    const inactive = createTodoCommentLikeFixture({ isActive: false });

    // When
    const results = [active.like(LATER), inactive.unlike(LATER)];

    // Then
    expect(results).toEqual([false, false]);
    expect([active.toPrimitives().updatedAt, inactive.toPrimitives().updatedAt]).toEqual([
      TODO_COMMENT_FIXTURE_NOW,
      TODO_COMMENT_FIXTURE_NOW,
    ]);
  });

  it("알림은 켜진 좋아요에 한 번만 남기고, 껐다 켜도 다시 알릴 차례가 되지 않는다", () => {
    // Given
    const like = createTodoCommentLikeFixture();

    // When
    const first = like.markNotified(LATER);
    like.unlike(LATER);
    like.like(LATER);
    const second = like.markNotified(LATER);

    // Then
    expect([first, second]).toEqual([true, false]);
    expect({
      hasBeenNotified: like.hasBeenNotified(),
      isNotificationPending: like.isNotificationPending(),
    }).toEqual({ hasBeenNotified: true, isNotificationPending: false });
  });
});
