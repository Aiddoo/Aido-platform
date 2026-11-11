import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

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
  abstract cleanupInTransaction(userId: UserId): Promise<TodoCommentAccountCleanupResult>;
  /** 끝난 계정 삭제를 캐시 장애 때문에 실패로 보고하지 않도록 모두 best-effort로 정리한다 */
  abstract settleAfterCommit(result: TodoCommentAccountCleanupResult): Promise<void>;
}
