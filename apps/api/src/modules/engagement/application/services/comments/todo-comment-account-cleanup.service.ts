import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { MutationLockKeys, type MutationLockPort } from "#api/shared/application/ports/index";

import { EngagementCommentLogEvent } from "../../observability/comments/engagement-comment-log.events.js";
import type {
  TodoCommentAccountCleanupPort,
  TodoCommentAccountCleanupResult,
} from "../../ports/comments/todo-comment-account-cleanup.port.js";
import { type TodoCommentAccountCleanupStorePort } from "../../ports/comments/todo-comment-account-cleanup.store.port.js";
import { type TodoViewCachePort } from "../../ports/comments/todo-view-cache.port.js";
import { settleAfterCommit } from "./settle-after-commit.js";

/**
 * auth 계정 purge가 소비하는 댓글 모듈의 공개 capability.
 *
 * cleanupInTransaction은 호출자가 연 UoW에 참여합니다. 계정 삭제보다 먼저 댓글 데이터와
 * counter를 정리해야 User FK의 RESTRICT가 마지막 안전망으로 동작합니다.
 */
interface TodoCommentAccountCleanupDependencies {
  readonly store: TodoCommentAccountCleanupStorePort;
  readonly todoViewCache: TodoViewCachePort;
  readonly mutationLock: MutationLockPort;
  readonly logger: ApplicationLogger;
}

export class TodoCommentAccountCleanup implements TodoCommentAccountCleanupPort {
  readonly #dependencies: TodoCommentAccountCleanupDependencies;

  constructor(dependencies: TodoCommentAccountCleanupDependencies) {
    this.#dependencies = dependencies;
  }

  async cleanupInTransaction(userId: string): Promise<TodoCommentAccountCleanupResult> {
    const plan = await this.#dependencies.store.plan(userId);

    if (plan.commentIdsToLock.length > 0) {
      await this.#dependencies.mutationLock.acquire(
        plan.commentIdsToLock.map(MutationLockKeys.todoComment),
      );
    }

    await this.#dependencies.store.cleanup(userId, plan);
    return { affectedTodoIds: [...plan.affectedTodoIds] };
  }

  /** 이미 끝난 계정 삭제를 cache 장애 때문에 실패로 보고하지 않도록 전부 best-effort로 정리한다. */
  async settleAfterCommit(result: TodoCommentAccountCleanupResult): Promise<void> {
    await settleAfterCommit(
      this.#dependencies.logger,
      result.affectedTodoIds.map((todoId) => ({
        failureEvent: EngagementCommentLogEvent.ACCOUNT_CLEANUP_CACHE_INVALIDATION_FAILED,
        context: { todoId },
        run: () => this.#dependencies.todoViewCache.invalidateForTodo(todoId),
      })),
    );
  }
}
