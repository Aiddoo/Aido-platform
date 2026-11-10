import type { TodoCommentLikeResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { assertNotBlocked } from "../comments.errors.js";
import { assertTodoCommentAccess } from "../comments.errors.js";
import { EngagementCommentLogEvent } from "../comments.log-events.js";
import { settleAfterCommit } from "../comments.log-events.js";
import { type TodoCommentBlockReaderPort } from "../ports/todo-comment-block-reader.port.js";
import { type TodoCommentNotificationPort } from "../ports/todo-comment-notification.port.js";
import { type TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import { type TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";

export interface LikeTodoCommentInput {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
}

interface LikeTodoCommentDependencies {
  readonly reader: Pick<TodoCommentReaderPort, "findAccessibleTodoOwnerId" | "findUserDisplayName">;
  readonly repository: Pick<
    TodoCommentRepositoryPort,
    "findComment" | "setLike" | "findPendingLikeNotification" | "markLikeNotified"
  >;
  readonly notification: Pick<TodoCommentNotificationPort, "notifyCommentLiked">;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLoggerPort;
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

      if (comment == null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      comment.assertActive();
      await assertNotBlocked(this.#dependencies.blockReader, input.userId, comment.authorId);
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
      if (pending == null) {
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
