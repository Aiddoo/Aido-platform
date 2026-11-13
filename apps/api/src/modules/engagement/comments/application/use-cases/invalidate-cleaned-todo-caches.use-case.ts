import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { TodoViewCacheInvalidatorPort } from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { settleAfterCommit, TodoCommentLogEvent } from "../comments.log-events.js";

export interface InvalidateCleanedTodoCachesCommand {
  readonly todoIds: readonly number[];
}

interface InvalidateCleanedTodoCachesDependencies {
  readonly todoViewCache: Pick<TodoViewCacheInvalidatorPort, "invalidateForTodos">;
  readonly logger: ApplicationLoggerPort;
}

/** 끝난 계정 삭제를 캐시 장애 때문에 실패로 보고하지 않도록 best-effort로 정리한다. 소유자는 한 번에 찾는다 */
export class InvalidateCleanedTodoCachesUseCase {
  readonly #dependencies: InvalidateCleanedTodoCachesDependencies;

  constructor(dependencies: InvalidateCleanedTodoCachesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: InvalidateCleanedTodoCachesCommand): Promise<void> {
    const { todoViewCache, logger } = this.#dependencies;
    if (command.todoIds.length === 0) {
      return;
    }
    await settleAfterCommit(logger, [
      {
        failureEvent: TodoCommentLogEvent.ACCOUNT_CLEANUP_CACHE_INVALIDATION_FAILED,
        context: { todoCount: command.todoIds.length },
        run: () =>
          todoViewCache.invalidateForTodos(
            command.todoIds.map((todoId) => TodoId.reconstitute(todoId)),
          ),
      },
    ]);
  }
}
