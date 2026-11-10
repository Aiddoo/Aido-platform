import { TodoCommentLikeRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment-like.repository.port";
import type { TodoCommentId } from "#api/modules/engagement/comments/domain/todo-comment-id.vo";
import { TodoCommentLike } from "#api/modules/engagement/comments/domain/todo-comment-like.entity";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function copyOf(like: TodoCommentLike): TodoCommentLike {
  return TodoCommentLike.reconstitute(like.toPrimitives());
}

export class InMemoryTodoCommentLikeRepository extends TodoCommentLikeRepositoryPort {
  readonly #likes = new Map<string, TodoCommentLike>();

  constructor(likes: readonly TodoCommentLike[] = []) {
    super();
    for (const like of likes) {
      this.#likes.set(like.id.value, copyOf(like));
    }
  }

  list(): TodoCommentLike[] {
    return [...this.#likes.values()].map(copyOf);
  }

  async findByCommentIdAndUserId(
    commentId: TodoCommentId,
    userId: UserId,
  ): Promise<TodoCommentLike | null> {
    const like = this.#likes.get(`${commentId.value}:${userId.value}`);
    return like == null ? null : copyOf(like);
  }

  async save(like: TodoCommentLike): Promise<void> {
    const stored = this.#likes.get(like.id.value);
    // 다시 저장해도 처음 누른 시각은 그대로 둔다(Drizzle 저장소와 같다)
    const next =
      stored == null
        ? copyOf(like)
        : TodoCommentLike.reconstitute({
            ...like.toPrimitives(),
            createdAt: stored.toPrimitives().createdAt,
          });
    this.#likes.set(like.id.value, next);
  }

  async deactivateAllByCommentId(commentId: TodoCommentId, now: Temporal.Instant): Promise<void> {
    for (const like of this.#likes.values()) {
      if (like.commentId.equals(commentId) && like.deactivate(now)) {
        this.#likes.set(like.id.value, copyOf(like));
      }
    }
  }

  /** 계정 정리 대역이 사용자의 좋아요 행을 지울 때 쓴다 */
  removeByUserId(userId: string): void {
    for (const like of this.#likes.values()) {
      if (like.userId.value === userId) {
        this.#likes.delete(like.id.value);
      }
    }
  }
}
