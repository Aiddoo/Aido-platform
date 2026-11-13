import type { TodoCommentLikeRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment-like.repository.port";
import { TodoCommentId } from "#api/modules/engagement/comments/domain/todo-comment-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createTodoCommentLikeFixture,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_NOW,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";

/** 계약 suite가 좋아요를 달 글. 저장소 구현이 글을 미리 만들어 둔다 */
export const LIKED_COMMENT_IDS = [
  "cm1likedcomment0000000001",
  "cm1likedcomment0000000002",
] as const;

const LATER = TODO_COMMENT_FIXTURE_NOW.add({ minutes: 5 });
const VIEWER = UserId.reconstitute(TODO_COMMENT_FIXTURE_VIEWER_ID);

export function describeTodoCommentLikeRepositoryContract(
  createRepository: () => Promise<TodoCommentLikeRepositoryPort>,
): void {
  describe("댓글 좋아요 저장소 계약", () => {
    const [firstCommentId, secondCommentId] = LIKED_COMMENT_IDS;

    it("저장한 좋아요를 글·사용자로 찾고, 다시 저장하면 상태와 알림 시각을 덮어쓰며 처음 누른 시각은 둔다", async () => {
      // Given
      const repository = await createRepository();
      const like = createTodoCommentLikeFixture({ commentId: firstCommentId });
      await repository.save(like);
      const changed = createTodoCommentLikeFixture({
        commentId: firstCommentId,
        createdAt: LATER,
      });
      changed.markNotified(LATER);
      changed.unlike(LATER);

      // When
      await repository.save(changed);
      const found = await repository.findByCommentIdAndUserId(
        TodoCommentId.reconstitute(firstCommentId),
        VIEWER,
      );
      const missing = await repository.findByCommentIdAndUserId(
        TodoCommentId.reconstitute(secondCommentId),
        VIEWER,
      );

      // Then
      expect(found?.toPrimitives()).toEqual({
        ...like.toPrimitives(),
        isActive: false,
        notifiedAt: LATER,
        updatedAt: LATER,
      });
      expect(missing).toBeNull();
    });

    it("지운 글의 켜진 좋아요만 끄고 알림 이력과 다른 글의 좋아요는 둔다", async () => {
      // Given
      const repository = await createRepository();
      const notified = createTodoCommentLikeFixture({
        commentId: firstCommentId,
        notifiedAt: TODO_COMMENT_FIXTURE_NOW,
      });
      await repository.save(notified);
      await repository.save(
        createTodoCommentLikeFixture({
          commentId: firstCommentId,
          userId: TODO_COMMENT_FIXTURE_FRIEND_ID,
        }),
      );
      await repository.save(createTodoCommentLikeFixture({ commentId: secondCommentId }));

      // When
      await repository.unlikeAllByCommentId(TodoCommentId.reconstitute(firstCommentId), LATER);

      // Then
      const states = await Promise.all(
        [
          [firstCommentId, TODO_COMMENT_FIXTURE_VIEWER_ID],
          [firstCommentId, TODO_COMMENT_FIXTURE_FRIEND_ID],
          [secondCommentId, TODO_COMMENT_FIXTURE_VIEWER_ID],
        ].map(async ([commentId = "", userId = ""]) => {
          const like = await repository.findByCommentIdAndUserId(
            TodoCommentId.reconstitute(commentId),
            UserId.reconstitute(userId),
          );
          return { isActive: like?.isActive, wasEverNotified: like?.wasEverNotified };
        }),
      );
      expect(states).toEqual([
        { isActive: false, wasEverNotified: true },
        { isActive: false, wasEverNotified: false },
        { isActive: true, wasEverNotified: false },
      ]);
    });
  });
}
