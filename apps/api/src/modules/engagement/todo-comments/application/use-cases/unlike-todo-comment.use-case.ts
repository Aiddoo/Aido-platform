import type { TodoCommentLikeRepositoryPort } from "#api/modules/engagement/todo-comment-likes/engagement-todo-comment-likes.public";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import type { TodoCommentAccessReaderPort } from "../ports/todo-comment-access.reader.port.js";
import type { TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";
import type { TodoCommentLikeStateReadModel } from "../read-models/todo-comment.read-model.js";
import { commentNotFound, todoNotFound } from "../todo-comments.errors.js";
import { TodoCommentLockKeys } from "../todo-comments.lock-keys.js";

export interface UnlikeTodoCommentCommand {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
}

interface UnlikeTodoCommentDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly accessReader: Pick<TodoCommentAccessReaderPort, "findAccessibleTodoOwnerId">;
  readonly repository: Pick<TodoCommentRepositoryPort, "findByIdAndTodoId" | "save">;
  readonly likeRepository: Pick<TodoCommentLikeRepositoryPort, "findByCommentIdAndUserId" | "save">;
}

/** 누르지 않은 좋아요를 취소해도 성공한다. 알림 이력은 남긴다 */
export class UnlikeTodoCommentUseCase {
  readonly #dependencies: UnlikeTodoCommentDependencies;

  constructor(dependencies: UnlikeTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: UnlikeTodoCommentCommand): Promise<TodoCommentLikeStateReadModel> {
    const { unitOfWork, mutationLock, clock, accessReader, repository, likeRepository } =
      this.#dependencies;
    const todoId = TodoId.reconstitute(command.todoId);
    const commentId = TodoCommentId.reconstitute(command.commentId);
    const userId = UserId.reconstitute(command.userId);
    return unitOfWork.run(async () => {
      await mutationLock.acquire([TodoCommentLockKeys.comment(commentId)]);
      if ((await accessReader.findAccessibleTodoOwnerId(todoId, userId)) == null) {
        throw todoNotFound(todoId);
      }
      const comment = await repository.findByIdAndTodoId(commentId, todoId);
      if (comment == null) {
        throw commentNotFound(commentId);
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
