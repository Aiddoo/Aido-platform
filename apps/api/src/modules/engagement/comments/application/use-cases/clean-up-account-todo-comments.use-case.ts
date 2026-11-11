import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { TodoEngagementCounterPort } from "#api/modules/planning/todos/planning-todos.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentLockKeys } from "../comments.lock-keys.js";
import type { TodoCommentAccountCleanupResult } from "../ports/todo-comment-account-cleanup.port.js";
import type { TodoCommentPurgeRepositoryPort } from "../ports/todo-comment-purge.repository.port.js";

export interface CleanUpAccountTodoCommentsCommand {
  readonly userId: string;
}

interface CleanUpAccountTodoCommentsDependencies {
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly purgeRepository: TodoCommentPurgeRepositoryPort;
  readonly engagementCounter: Pick<
    TodoEngagementCounterPort,
    "lockCounters" | "replaceCommentCounts"
  >;
}

/**
 * 계정 hard delete 전에 호출자의 UoW 안에서 댓글 데이터와 수를 정리한다.
 * 잠금 순서: 댓글 advisory 잠금 → 할 일 행 → 댓글 행. 작성·삭제와 같은 순서라 교착하지 않는다.
 */
export class CleanUpAccountTodoCommentsUseCase {
  readonly #dependencies: CleanUpAccountTodoCommentsDependencies;

  constructor(dependencies: CleanUpAccountTodoCommentsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    command: CleanUpAccountTodoCommentsCommand,
  ): Promise<TodoCommentAccountCleanupResult> {
    const { mutationLock, clock, purgeRepository, engagementCounter } = this.#dependencies;
    const userId = UserId.reconstitute(command.userId);
    const plan = await purgeRepository.planPurge(userId);
    if (plan.commentIdsToLock.length > 0) {
      await mutationLock.acquire(plan.commentIdsToLock.map(TodoCommentLockKeys.comment));
    }
    if (plan.affectedTodoIds.length > 0) {
      await engagementCounter.lockCounters(
        plan.affectedTodoIds.map((todoId) => TodoId.reconstitute(todoId)),
      );
      const commentCounts = await purgeRepository.purge(userId, plan, clock.now());
      await engagementCounter.replaceCommentCounts(commentCounts);
    }
    return { affectedTodoIds: [...plan.affectedTodoIds] };
  }
}
