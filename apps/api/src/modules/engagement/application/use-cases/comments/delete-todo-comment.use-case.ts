import type { DeleteTodoCommentResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { uniq } from "es-toolkit";

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
  readonly reader: Pick<TodoCommentReaderPort, "findAccessibleTodoOwnerId">;
  readonly repository: Pick<
    TodoCommentRepositoryPort,
    "findComment" | "decrementTodoCommentCount" | "deleteComment" | "decreaseReplyCount"
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
      const todoOwnerId = await assertTodoCommentAccess(
        this.#dependencies.reader,
        input.todoId,
        input.userId,
      );
      const snapshot = await this.#dependencies.repository.findComment(
        input.todoId,
        input.commentId,
      );

      if (snapshot == null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      // 답글 수가 바뀌는 묶음 머리까지 작성과 같은 순서로 한 번에 잠근다. 묶음 머리는 바뀌지 않는다.
      await this.#dependencies.mutationLock.acquire(
        uniq([input.commentId, snapshot.threadCommentId]).map(MutationLockKeys.todoComment),
      );
      const comment = await this.#dependencies.repository.findComment(
        input.todoId,
        input.commentId,
      );

      if (comment == null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      if (!comment.markDeleted({ actorId: input.userId, todoOwnerId, deletedAt: now() })) {
        return false;
      }

      const countDecremented = await this.#dependencies.repository.decrementTodoCommentCount(
        input.todoId,
      );
      if (!countDecremented || !(await this.#dependencies.repository.deleteComment(comment))) {
        throw new ApplicationException(ErrorCode.SYS_0003, { commentId: input.commentId });
      }

      if (comment.isReply) {
        await this.removeReplyFromThread(input.todoId, comment.threadCommentId);
      }

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

  private async removeReplyFromThread(todoId: number, threadCommentId: string): Promise<void> {
    const thread = await this.#dependencies.repository.findComment(todoId, threadCommentId);
    if (thread == null) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId: threadCommentId });
    }

    thread.applyReplyRemoved();
    if (!(await this.#dependencies.repository.decreaseReplyCount(threadCommentId))) {
      throw new ApplicationException(ErrorCode.SYS_0003, { commentId: threadCommentId });
    }
  }
}
