import type { DeleteTodoCommentResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/index";

import { EngagementCommentLogEvent } from "../../observability/comments/engagement-comment-log.events.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import { type TodoCommentRepositoryPort } from "../../ports/comments/todo-comment.repository.port.js";
import { type TodoViewCachePort } from "../../ports/comments/todo-view-cache.port.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";
import { settleAfterCommit } from "../../services/comments/settle-after-commit.js";

export interface DeleteTodoCommentInput {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
}

interface DeleteTodoCommentDependencies {
  readonly reader: Pick<TodoCommentReaderPort, "canAccessTodo">;
  readonly repository: Pick<
    TodoCommentRepositoryPort,
    "findComment" | "decrementTodoCommentCount" | "deleteComment" | "dropDeletedFromAncestors"
  >;
  readonly todoViewCache: TodoViewCachePort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class DeleteTodoComment {
  readonly #dependencies: DeleteTodoCommentDependencies;

  constructor(dependencies: DeleteTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteTodoCommentInput): Promise<DeleteTodoCommentResponse> {
    const outcome = await this.#dependencies.unitOfWork.run(async () => {
      await assertTodoCommentAccess(this.#dependencies.reader, input.todoId, input.userId);
      const snapshot = await this.#dependencies.repository.findComment(
        input.todoId,
        input.commentId,
      );

      if (snapshot === null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      // 삭제 정산이 replyCount를 건드리는 모든 조상까지 한 번에 잠근다.
      await this.#dependencies.mutationLock.acquire(
        [input.commentId, ...snapshot.placement.path].map(MutationLockKeys.todoComment),
      );
      const comment = await this.#dependencies.repository.findComment(
        input.todoId,
        input.commentId,
      );

      if (comment === null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      if (comment.isDeleted) {
        comment.delete(input.userId, now());
        return false;
      }

      comment.delete(input.userId, now());
      const countDecremented = await this.#dependencies.repository.decrementTodoCommentCount(
        input.todoId,
      );

      if (!countDecremented || !(await this.#dependencies.repository.deleteComment(comment))) {
        throw new ApplicationException(ErrorCode.SYS_0003, { commentId: input.commentId });
      }

      await this.#dependencies.repository.dropDeletedFromAncestors(
        input.commentId,
        comment.placement.path,
      );

      return true;
    });

    if (outcome) {
      await settleAfterCommit(this.#dependencies.logger, [
        {
          failureEvent: EngagementCommentLogEvent.VIEW_CACHE_INVALIDATION_FAILED,
          context: { todoId: input.todoId, commentId: input.commentId, userId: input.userId },
          run: () => this.#dependencies.todoViewCache.invalidateForTodo(input.todoId),
        },
      ]);
    }

    return { commentId: input.commentId, isDeleted: true };
  }
}
