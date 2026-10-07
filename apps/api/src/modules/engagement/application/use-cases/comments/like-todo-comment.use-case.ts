import type { TodoCommentLikeResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { type TodoCommentNotificationPort } from "../../ports/comments/todo-comment-notification.port.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import { type TodoCommentRepositoryPort } from "../../ports/comments/todo-comment.repository.port.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";
import { settleAfterCommit } from "../../services/comments/settle-after-commit.js";

export interface LikeTodoCommentInput {
  todoId: number;
  commentId: string;
  userId: string;
}

interface LikeTodoCommentDependencies {
  readonly reader: TodoCommentReaderPort;
  readonly repository: TodoCommentRepositoryPort;
  readonly notification: TodoCommentNotificationPort;
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
      return { transition, senderName, threadRootId: comment.threadRootId.getValue() };
    });

    const recipientId = likeOutcome.transition.commentAuthorId;
    if (
      likeOutcome.transition.changed &&
      !likeOutcome.transition.wasEverNotified &&
      recipientId !== null
    ) {
      await settleAfterCommit(this.#dependencies.logger, [
        {
          label: "댓글 좋아요 알림",
          run: () =>
            this.#notifyLiked(input, recipientId, {
              senderName: likeOutcome.senderName,
              threadRootId: likeOutcome.threadRootId,
            }),
        },
      ]);
    }

    return {
      commentId: input.commentId,
      isLiked: true,
      likeCount: likeOutcome.transition.likeCount,
    };
  }

  /** 알림 성공 뒤에만 표시해 일시 실패를 영구 유실로 만들지 않는다. */
  async #notifyLiked(
    input: LikeTodoCommentInput,
    recipientId: string,
    context: { senderName: string | null; threadRootId: string },
  ): Promise<void> {
    await this.#dependencies.notification.notifyCommentLiked({
      recipientId,
      senderId: input.userId,
      senderName: context.senderName,
      todoId: input.todoId,
      commentId: input.commentId,
      threadRootId: context.threadRootId,
    });
    await this.#dependencies.repository.markLikeNotified(input.commentId, input.userId);
  }
}
