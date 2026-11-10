export const TODO_COMMENT_PURGE_REPOSITORY = Symbol("TODO_COMMENT_PURGE_REPOSITORY");

export interface TodoCommentPurgePlan {
  readonly affectedTodoIds: readonly number[];
  readonly commentIdsToLock: readonly string[];
}

/** 계정 hard delete 전에 댓글 도메인이 소유한 데이터와 비정규화 counter를 함께 정리한다. */
export interface TodoCommentPurgeRepositoryPort {
  plan(userId: string): Promise<TodoCommentPurgePlan>;
  cleanup(userId: string, plan: TodoCommentPurgePlan): Promise<void>;
}
