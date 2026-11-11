import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  TodoCommentAccountCleanupPort,
  type TodoCommentAccountCleanupResult,
} from "../../application/ports/todo-comment-account-cleanup.port.js";
import { CleanUpAccountTodoCommentsUseCase } from "../../application/use-cases/clean-up-account-todo-comments.use-case.js";
import { InvalidateCleanedTodoCachesUseCase } from "../../application/use-cases/invalidate-cleaned-todo-caches.use-case.js";

/** 계정 purge가 부르는 공개 포트를 두 UseCase로 잇는다 */
@Injectable()
export class TodoCommentAccountCleanupAdapter implements TodoCommentAccountCleanupPort {
  readonly #cleanUp: CleanUpAccountTodoCommentsUseCase;
  readonly #invalidateCaches: InvalidateCleanedTodoCachesUseCase;

  constructor(
    cleanUp: CleanUpAccountTodoCommentsUseCase,
    invalidateCaches: InvalidateCleanedTodoCachesUseCase,
  ) {
    this.#cleanUp = cleanUp;
    this.#invalidateCaches = invalidateCaches;
  }

  cleanupInTransaction(userId: UserId): Promise<TodoCommentAccountCleanupResult> {
    return this.#cleanUp.execute({ userId: userId.value });
  }

  settleAfterCommit(result: TodoCommentAccountCleanupResult): Promise<void> {
    return this.#invalidateCaches.execute({ todoIds: result.affectedTodoIds });
  }
}
