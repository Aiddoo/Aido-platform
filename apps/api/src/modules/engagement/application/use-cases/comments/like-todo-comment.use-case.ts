import type { TodoCommentLikeResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { EngagementCommentLogEvent } from "../../observability/comments/engagement-comment-log.events.js";
import { type TodoCommentNotificationPort } from "../../ports/comments/todo-comment-notification.port.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import { type TodoCommentRepositoryPort } from "../../ports/comments/todo-comment.repository.port.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";
import { settleAfterCommit } from "../../services/comments/settle-after-commit.js";

export interface LikeTodoCommentInput {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
}

interface LikeTodoCommentDependencies {
  readonly reader: Pick<TodoCommentReaderPort, "canAccessTodo" | "findUserDisplayName">;
  readonly repository: Pick<
    TodoCommentRepositoryPort,
    "findComment" | "setLike" | "findPendingLikeNotification" | "markLikeNotified"
  >;
  readonly notification: Pick<TodoCommentNotificationPort, "notifyCommentLiked">;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class LikeTodoComment {
  readonly #dependencies: LikeTodoCommentDependencies;

  constructor(dependencies: LikeTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LikeTodoCommentInput): Promise<TodoCommentLikeResponse> {
    const likeOutcome = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoComment(input.commentId),
      ]);
      await assertTodoCommentAccess(this.#dependencies.reader, input.todoId, input.userId);
      const comment = await this.#dependencies.repository.findComment(
        input.todoId,
        input.commentId,
      );

      if (comment === null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      comment.assertCanReceiveInteraction();
      const senderName = await this.#dependencies.reader.findUserDisplayName(input.userId);
      const transition = await this.#dependencies.repository.setLike(
        input.todoId,
        input.commentId,
        input.userId,
      );
      return { transition, senderName };
    });

    if (!likeOutcome.transition.wasEverNotified) {
      await settleAfterCommit(this.#dependencies.logger, [
        {
          failureEvent: EngagementCommentLogEvent.LIKE_NOTIFICATION_FAILED,
          context: { todoId: input.todoId, commentId: input.commentId, userId: input.userId },
          run: () => this.#notifyLiked(input, likeOutcome.senderName),
        },
      ]);
    }

    return {
      commentId: input.commentId,
      isLiked: true,
      likeCount: likeOutcome.transition.likeCount,
    };
  }

  async #notifyLiked(input: LikeTodoCommentInput, senderName: string | null): Promise<void> {
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoComment(input.commentId),
      ]);
      const pending = await this.#dependencies.repository.findPendingLikeNotification(
        input.todoId,
        input.commentId,
        input.userId,
      );
      if (pending === null) {
        return;
      }

      await this.#dependencies.notification.notifyCommentLiked({
        recipientId: pending.recipientId,
        senderId: input.userId,
        senderName,
        todoId: input.todoId,
        commentId: input.commentId,
        threadRootId: pending.threadRootId,
      });
      await this.#dependencies.repository.markLikeNotified(input.commentId, input.userId);
    });
  }
}
