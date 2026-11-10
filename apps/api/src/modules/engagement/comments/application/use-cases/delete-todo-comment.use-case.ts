import { uniq } from "es-toolkit";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type {
  TodoEngagementCounterPort,
  TodoViewCacheInvalidatorPort,
} from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import { commentNotFound, commentStateConflict, todoNotFound } from "../comments.errors.js";
import { TodoCommentLockKeys } from "../comments.lock-keys.js";
import { settleAfterCommit, TodoCommentLogEvent } from "../comments.log-events.js";
import type { TodoCommentLikeRepositoryPort } from "../ports/todo-comment-like.repository.port.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import type { TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";

export interface DeleteTodoCommentCommand {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
}

interface DeleteTodoCommentDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly reader: Pick<TodoCommentReaderPort, "findAccessibleTodoOwnerId">;
  readonly repository: Pick<TodoCommentRepositoryPort, "findByIdAndTodoId" | "save">;
  readonly likeRepository: Pick<TodoCommentLikeRepositoryPort, "deactivateAllByCommentId">;
  readonly engagementCounter: Pick<TodoEngagementCounterPort, "decrementCommentCount">;
  readonly todoViewCache: Pick<TodoViewCacheInvalidatorPort, "invalidateForTodo">;
  readonly logger: ApplicationLoggerPort;
}

/** 같은 글을 다시 지워도 성공한다. 답글이 남은 댓글은 모두에게 묘비로 남는다 */
export class DeleteTodoCommentUseCase {
  readonly #dependencies: DeleteTodoCommentDependencies;

  constructor(dependencies: DeleteTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: DeleteTodoCommentCommand): Promise<void> {
    const { unitOfWork, todoViewCache, logger } = this.#dependencies;
    const isDeleted = await unitOfWork.run(() => this.#delete(command));
    if (isDeleted) {
      await settleAfterCommit(logger, [
        {
          failureEvent: TodoCommentLogEvent.VIEW_CACHE_INVALIDATION_FAILED,
          context: {
            todoId: command.todoId,
            commentId: command.commentId,
            userId: command.userId,
          },
          run: () => todoViewCache.invalidateForTodo(command.todoId),
        },
      ]);
    }
  }

  async #delete(command: DeleteTodoCommentCommand): Promise<boolean> {
    const { mutationLock, clock, reader, repository, likeRepository, engagementCounter } =
      this.#dependencies;
    const todoId = TodoId.reconstitute(command.todoId);
    const userId = UserId.reconstitute(command.userId);
    const commentId = TodoCommentId.reconstitute(command.commentId);
    const todoOwnerId = await reader.findAccessibleTodoOwnerId(todoId, userId);
    if (todoOwnerId == null) {
      throw todoNotFound(command.todoId);
    }
    const unlocked = await repository.findByIdAndTodoId(commentId, todoId);
    if (unlocked == null) {
      throw commentNotFound(command.commentId);
    }
    // 답글 수가 바뀌는 묶음 머리까지 작성과 같은 순서로 한 번에 잠근다. 묶음 머리는 바뀌지 않는다
    await mutationLock.acquire(
      uniq([command.commentId, unlocked.threadCommentId.value]).map(TodoCommentLockKeys.comment),
    );
    const comment = await repository.findByIdAndTodoId(commentId, todoId);
    if (comment == null) {
      throw commentNotFound(command.commentId);
    }
    const now = clock.now();
    const isDeleted = comment.markDeleted({
      actorId: userId,
      todoOwnerId: UserId.reconstitute(todoOwnerId),
      now,
    });
    if (!isDeleted) {
      return false;
    }
    if (!(await engagementCounter.decrementCommentCount(command.todoId))) {
      throw commentStateConflict(command.commentId);
    }
    await repository.save(comment);
    await likeRepository.deactivateAllByCommentId(commentId, now);
    if (comment.isReply) {
      const thread = await repository.findByIdAndTodoId(comment.threadCommentId, todoId);
      if (thread == null) {
        throw commentStateConflict(comment.threadCommentId.value);
      }
      thread.removeReply(now);
      await repository.save(thread);
    }
    return true;
  }
}
