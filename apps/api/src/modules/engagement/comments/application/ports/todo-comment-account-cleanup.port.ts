// 옛 Symbol 토큰. identity가 클래스 토큰으로 옮길 때까지 같은 인스턴스 별칭으로 남긴다
export const TODO_COMMENT_ACCOUNT_CLEANUP = Symbol("TODO_COMMENT_ACCOUNT_CLEANUP");

export interface TodoCommentAccountCleanupResult {
  readonly affectedTodoIds: readonly number[];
}

/**
 * 계정 purge가 쓰는 댓글 쪽 공개 capability.
 *
 * cleanupInTransaction은 호출자가 연 UoW에 참여한다. 계정 삭제보다 먼저 댓글 데이터와 수를 정리해야
 * User FK의 RESTRICT가 마지막 안전망으로 남는다.
 */
export abstract class TodoCommentAccountCleanupPort {
  abstract cleanupInTransaction(userId: string): Promise<TodoCommentAccountCleanupResult>;
  /** 끝난 계정 삭제를 캐시 장애 때문에 실패로 보고하지 않도록 모두 best-effort로 정리한다 */
  abstract settleAfterCommit(result: TodoCommentAccountCleanupResult): Promise<void>;
}
