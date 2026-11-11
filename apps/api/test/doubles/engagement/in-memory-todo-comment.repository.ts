import { TodoCommentIdempotencyRace } from "#api/modules/engagement/comments/application/comments.errors";
import { TodoCommentRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment.repository.port";
import { TodoCommentId } from "#api/modules/engagement/comments/domain/todo-comment-id.vo";
import { TodoComment } from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(comment: TodoComment): TodoComment {
  return TodoComment.reconstitute(comment.toPrimitives());
}

export class InMemoryTodoCommentRepository extends TodoCommentRepositoryPort {
  readonly #comments = new Map<string, TodoComment>();
  #sequence = 0;

  constructor(comments: readonly TodoComment[] = []) {
    super();
    for (const comment of comments) {
      this.#comments.set(comment.id.value, copyOf(comment));
    }
  }

  /** 저장된 모든 글의 사본. 테스트 확인과 다른 대역이 읽는 데 쓴다 */
  list(): TodoComment[] {
    return [...this.#comments.values()].map(copyOf);
  }

  async nextId(): Promise<TodoCommentId> {
    this.#sequence += 1;
    return TodoCommentId.reconstitute(`cmmemory${String(this.#sequence).padStart(17, "0")}`);
  }

  async findByIdAndTodoId(commentId: TodoCommentId, todoId: TodoId): Promise<TodoComment | null> {
    const comment = this.#comments.get(commentId.value);
    return comment != null && comment.todoId === todoId.value ? copyOf(comment) : null;
  }

  async listByAuthorIdAndClientRequestIds(
    authorId: UserId,
    clientRequestIds: readonly string[],
  ): Promise<TodoComment[]> {
    const requested = new Set(clientRequestIds);
    return this.list().filter(
      (comment) => comment.authorId.equals(authorId) && requested.has(comment.clientRequestId),
    );
  }

  async save(comment: TodoComment): Promise<void> {
    const isNew = !this.#comments.has(comment.id.value);
    const isDuplicateRequest = [...this.#comments.values()].some(
      (stored) =>
        stored.authorId.equals(comment.authorId) &&
        stored.clientRequestId === comment.clientRequestId,
    );
    if (isNew && isDuplicateRequest) {
      throw new TodoCommentIdempotencyRace();
    }
    const stored = this.#comments.get(comment.id.value);
    // 다시 저장해도 생성 때 정한 칸은 그대로 둔다(Drizzle 저장소와 같다)
    const next =
      stored == null
        ? copyOf(comment)
        : TodoComment.reconstitute({
            ...stored.toPrimitives(),
            content: comment.toPrimitives().content,
            likeCount: comment.likeCount,
            replyCount: comment.replyCount,
            deletedAt: comment.toPrimitives().deletedAt,
            editedAt: comment.toPrimitives().editedAt,
            updatedAt: comment.toPrimitives().updatedAt,
          });
    this.#comments.set(comment.id.value, next);
  }

  /** 계정 정리 대역이 저장소를 거치지 않고 바꾸는 칸(작성자·멱등 키) */
  replace(comment: TodoComment): void {
    this.#comments.set(comment.id.value, copyOf(comment));
  }
}
