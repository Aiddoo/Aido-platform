import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import { commentNotFound, todoNotFound } from "../comments.errors.js";
import { TodoCommentLockKeys } from "../comments.lock-keys.js";
import type { TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import type { TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";
import type { TodoCommentWithViewer } from "../read-models/todo-comment.read-model.js";

export interface UpdateTodoCommentCommand {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
  readonly content: string;
}

interface UpdateTodoCommentDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly reader: Pick<
    TodoCommentReaderPort,
    "findAccessibleTodoOwnerId" | "findComment" | "listLikedCommentIds"
  >;
  readonly repository: Pick<TodoCommentRepositoryPort, "findByIdAndTodoId" | "save">;
}

export class UpdateTodoCommentUseCase {
  readonly #dependencies: UpdateTodoCommentDependencies;

  constructor(dependencies: UpdateTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: UpdateTodoCommentCommand): Promise<TodoCommentWithViewer> {
    const { unitOfWork, mutationLock, clock, reader, repository } = this.#dependencies;
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
      comment.edit(userId, command.content, clock.now());
      await repository.save(comment);

      const updated = await reader.findComment(todoId, commentId);
      if (updated == null) {
        throw commentNotFound(command.commentId);
      }
      const likedCommentIds = await reader.listLikedCommentIds([commentId], userId);
      return {
        comment: updated,
        viewer: { viewerId: command.userId, likedCommentIds, blockedAuthorIds: new Set() },
      };
    });
  }
}
