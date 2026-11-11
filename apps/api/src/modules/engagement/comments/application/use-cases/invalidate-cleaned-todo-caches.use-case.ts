import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { TodoViewCacheInvalidatorPort } from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { settleAfterCommit, TodoCommentLogEvent } from "../comments.log-events.js";

export interface InvalidateCleanedTodoCachesCommand {
  readonly todoIds: readonly number[];
}

interface InvalidateCleanedTodoCachesDependencies {
  readonly todoViewCache: Pick<TodoViewCacheInvalidatorPort, "invalidateForTodo">;
  readonly logger: ApplicationLoggerPort;
}

/** 끝난 계정 삭제를 캐시 장애 때문에 실패로 보고하지 않도록 할 일마다 best-effort로 정리한다 */
export class InvalidateCleanedTodoCachesUseCase {
  readonly #dependencies: InvalidateCleanedTodoCachesDependencies;

  constructor(dependencies: InvalidateCleanedTodoCachesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: InvalidateCleanedTodoCachesCommand): Promise<void> {
    const { todoViewCache, logger } = this.#dependencies;
    await settleAfterCommit(
      logger,
      command.todoIds.map((todoId) => ({
        failureEvent: TodoCommentLogEvent.ACCOUNT_CLEANUP_CACHE_INVALIDATION_FAILED,
        context: { todoId },
        run: () => todoViewCache.invalidateForTodo(TodoId.reconstitute(todoId)),
      })),
    );
  }
}
