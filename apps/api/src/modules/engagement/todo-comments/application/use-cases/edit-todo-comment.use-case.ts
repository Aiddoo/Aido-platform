import type { TodoCommentLikeReaderPort } from "#api/modules/engagement/todo-comment-likes/engagement-todo-comment-likes.public";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../../shared/domain/todo-comment-id.vo.js";
import type { TodoCommentAccessReaderPort } from "../ports/todo-comment-access.reader.port.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import type { TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";
import type { TodoCommentWithViewerReadModel } from "../read-models/todo-comment.read-model.js";
import { commentNotFound, todoNotFound } from "../todo-comments.errors.js";
import { TodoCommentLockKeys } from "../todo-comments.lock-keys.js";

export interface EditTodoCommentCommand {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
  readonly content: string;
}

interface EditTodoCommentDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly accessReader: Pick<TodoCommentAccessReaderPort, "findAccessibleTodoOwnerId">;
  readonly reader: Pick<TodoCommentReaderPort, "findComment">;
  readonly likeReader: Pick<TodoCommentLikeReaderPort, "listLikedCommentIds">;
  readonly repository: Pick<TodoCommentRepositoryPort, "findByIdAndTodoId" | "save">;
}

export class EditTodoCommentUseCase {
  readonly #dependencies: EditTodoCommentDependencies;

  constructor(dependencies: EditTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: EditTodoCommentCommand): Promise<TodoCommentWithViewerReadModel> {
    const { unitOfWork, mutationLock, clock, accessReader, reader, likeReader, repository } =
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
      comment.edit(userId, command.content, clock.now());
      await repository.save(comment);

      const edited = await reader.findComment(todoId, commentId);
      if (edited == null) {
        throw commentNotFound(commentId);
      }
      const likedCommentIds = await likeReader.listLikedCommentIds([commentId], userId);
      return {
        comment: edited,
        viewer: { viewerId: command.userId, likedCommentIds, blockedAuthorIds: new Set() },
      };
    });
  }
}
