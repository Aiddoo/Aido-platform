import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { TodoCommentCount } from "#api/modules/planning/todos/planning-todos.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";

export interface TodoCommentPurgePlan {
  /** 지울 사용자가 쓰거나 좋아요한 글이 있는 할 일. id 오름차순이다 */
  readonly affectedTodoIds: readonly TodoId[];
  /** 그 할 일들의 모든 글. 작성·삭제와 같은 순서로 잠그려고 id 오름차순이다 */
  readonly commentIdsToLock: readonly TodoCommentId[];
}

/**
 * 계정을 hard delete하기 전에 댓글 쪽이 소유한 데이터와 비정규화 수를 정리한다.
 * 글과 좋아요를 한 문장씩 함께 옮기는 작업 원장이라 좋아요 행도 여기서 지우고 끈다.
 */
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
