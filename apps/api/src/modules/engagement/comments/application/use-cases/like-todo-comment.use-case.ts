import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import { TodoCommentLike } from "../../domain/todo-comment-like.aggregate.js";
import {
  blockedCounterpart,
  commentNotFound,
  commentStateConflict,
  todoNotFound,
} from "../comments.errors.js";
import { TodoCommentLockKeys } from "../comments.lock-keys.js";
import { settleAfterCommit, TodoCommentLogEvent } from "../comments.log-events.js";
import type { TodoCommentBlockReaderPort } from "../ports/todo-comment-block-reader.port.js";
import type { TodoCommentLikeRepositoryPort } from "../ports/todo-comment-like.repository.port.js";
import type { TodoCommentNotificationPort } from "../ports/todo-comment-notification.port.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import type { TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";
import type { TodoCommentLikeState } from "../read-models/todo-comment.read-model.js";

export interface LikeTodoCommentCommand {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
}

interface LikeTodoCommentDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly reader: Pick<TodoCommentReaderPort, "findAccessibleTodoOwnerId" | "findUserDisplayName">;
  readonly repository: Pick<TodoCommentRepositoryPort, "findByIdAndTodoId" | "save">;
  readonly likeRepository: Pick<TodoCommentLikeRepositoryPort, "findByCommentIdAndUserId" | "save">;
  readonly notification: Pick<TodoCommentNotificationPort, "notifyCommentLiked">;
  readonly blockReader: Pick<TodoCommentBlockReaderPort, "findBlockedCounterpartIds">;
  readonly logger: ApplicationLoggerPort;
}

interface LikeOutcome {
  readonly likeCount: number;
  readonly wasEverNotified: boolean;
  readonly senderName: string | null;
}

/** 이미 누른 좋아요도 성공한다. 알림은 한 번만 보내고, 껐다 켜도 다시 알리지 않는다 */
export class LikeTodoCommentUseCase {
  readonly #dependencies: LikeTodoCommentDependencies;

  constructor(dependencies: LikeTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: LikeTodoCommentCommand): Promise<TodoCommentLikeState> {
    const { unitOfWork, logger } = this.#dependencies;
    const outcome = await unitOfWork.run(() => this.#like(command));
    if (!outcome.wasEverNotified) {
      await settleAfterCommit(logger, [
        {
          failureEvent: TodoCommentLogEvent.LIKE_NOTIFICATION_FAILED,
          context: {
            todoId: command.todoId,
            commentId: command.commentId,
            userId: command.userId,
          },
          run: () => this.#notifyLiked(command, outcome.senderName),
        },
      ]);
    }
    return { commentId: command.commentId, isLiked: true, likeCount: outcome.likeCount };
  }

  async #like(command: LikeTodoCommentCommand): Promise<LikeOutcome> {
    const { mutationLock, clock, reader, repository, likeRepository, blockReader } =
      this.#dependencies;
    const todoId = TodoId.reconstitute(command.todoId);
    const commentId = TodoCommentId.reconstitute(command.commentId);
    const userId = UserId.reconstitute(command.userId);
    await mutationLock.acquire([TodoCommentLockKeys.comment(command.commentId)]);
    if ((await reader.findAccessibleTodoOwnerId(todoId, userId)) == null) {
      throw todoNotFound(command.todoId);
    }
    const comment = await repository.findByIdAndTodoId(commentId, todoId);
    if (comment == null) {
      throw commentNotFound(command.commentId);
    }
    comment.assertActive();
    const blockedIds = await blockReader.findBlockedCounterpartIds(userId, [comment.authorId]);
    if (blockedIds.has(comment.authorId.value)) {
      throw blockedCounterpart();
    }
    const senderName = await reader.findUserDisplayName(userId);
    const existing = await likeRepository.findByCommentIdAndUserId(commentId, userId);
    if (existing?.isActive === true) {
      return {
        likeCount: comment.likeCount,
        wasEverNotified: existing.wasEverNotified,
        senderName,
      };
    }

    const now = clock.now();
    const commentLike = existing ?? TodoCommentLike.create({ commentId, userId, now });
    commentLike.like(now);
    await likeRepository.save(commentLike);
    comment.addLike(now);
    await repository.save(comment);
    return {
      likeCount: comment.likeCount,
      wasEverNotified: commentLike.wasEverNotified,
      senderName,
    };
  }

  /** 알림과 발송 outbox를 저장하는 동안 취소·재설정이 끼어들지 않도록 같은 댓글 잠금 안에서 다시 확인한다 */
  async #notifyLiked(command: LikeTodoCommentCommand, senderName: string | null): Promise<void> {
    const { unitOfWork, mutationLock, clock, repository, likeRepository, notification } =
      this.#dependencies;
    const commentId = TodoCommentId.reconstitute(command.commentId);
    await unitOfWork.run(async () => {
      await mutationLock.acquire([TodoCommentLockKeys.comment(command.commentId)]);
      const comment = await repository.findByIdAndTodoId(
        commentId,
        TodoId.reconstitute(command.todoId),
      );
      const like = await likeRepository.findByCommentIdAndUserId(
        commentId,
        UserId.reconstitute(command.userId),
      );
      if (comment == null || comment.isDeleted || like?.isNotificationPending !== true) {
        return;
      }
      await notification.notifyCommentLiked({
        recipientId: comment.authorId.value,
        senderId: command.userId,
        senderName,
        todoId: command.todoId,
        commentId: command.commentId,
        threadRootId: comment.threadCommentId.value,
      });
      if (!like.markNotified(clock.now())) {
        throw commentStateConflict(command.commentId);
      }
      await likeRepository.save(like);
    });
  }
}
