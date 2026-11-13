import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import { commentNotFound, todoNotFound } from "../comments.errors.js";
import { TodoCommentLockKeys } from "../comments.lock-keys.js";
import type { TodoCommentLikeRepositoryPort } from "../ports/todo-comment-like.repository.port.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import type { TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";
import type { TodoCommentLikeState } from "../read-models/todo-comment.read-model.js";

export interface UnlikeTodoCommentCommand {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
}

interface UnlikeTodoCommentDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly reader: Pick<TodoCommentReaderPort, "findAccessibleTodoOwnerId">;
  readonly repository: Pick<TodoCommentRepositoryPort, "findByIdAndTodoId" | "save">;
  readonly likeRepository: Pick<TodoCommentLikeRepositoryPort, "findByCommentIdAndUserId" | "save">;
}

/** 누르지 않은 좋아요를 취소해도 성공한다. 알림 이력은 남긴다 */
export class UnlikeTodoCommentUseCase {
  readonly #dependencies: UnlikeTodoCommentDependencies;

  constructor(dependencies: UnlikeTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: UnlikeTodoCommentCommand): Promise<TodoCommentLikeState> {
    const { unitOfWork, mutationLock, clock, reader, repository, likeRepository } =
      this.#dependencies;
    return unitOfWork.run(async () => {
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
      const like = await likeRepository.findByCommentIdAndUserId(commentId, userId);
      const now = clock.now();
      if (like?.unlike(now) === true) {
        await likeRepository.save(like);
        comment.removeLike(now);
        await repository.save(comment);
      }
      return { commentId: command.commentId, isLiked: false, likeCount: comment.likeCount };
    });
  }
}
