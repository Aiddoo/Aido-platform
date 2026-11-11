import type { TodoCommentCount } from "#api/modules/planning/todos/planning-todos.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface TodoCommentPurgePlan {
  /** 지울 사용자가 쓰거나 좋아요한 글이 있는 할 일. id 오름차순이다 */
  readonly affectedTodoIds: readonly number[];
  /** 그 할 일들의 모든 글. 작성·삭제와 같은 순서로 잠그려고 id 오름차순이다 */
  readonly commentIdsToLock: readonly string[];
}

/** 계정을 hard delete하기 전에 댓글 쪽이 소유한 데이터와 비정규화 수를 정리한다 */
export abstract class TodoCommentPurgeRepositoryPort {
  abstract planPurge(userId: UserId): Promise<TodoCommentPurgePlan>;
  /**
   * 계획한 할 일의 글을 행 잠금한 뒤 사용자의 좋아요를 지우고, 쓴 글을 묘비로 남겨 시스템 작성자로 넘긴다.
   * 좋아요 수·답글 수를 실제 행으로 다시 세고, 할 일마다 지워지지 않은 글 수를 돌려준다.
   */
  abstract purge(
    userId: UserId,
    plan: TodoCommentPurgePlan,
    now: Temporal.Instant,
  ): Promise<TodoCommentCount[]>;
}
