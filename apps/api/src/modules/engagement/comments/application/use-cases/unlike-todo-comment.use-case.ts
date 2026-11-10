import type { TodoCommentLikeResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { assertTodoCommentAccess } from "../comments.errors.js";
import { type TodoCommentReaderPort } from "../ports/todo-comment.reader.port.js";
import { type TodoCommentRepositoryPort } from "../ports/todo-comment.repository.port.js";

export interface UnlikeTodoCommentInput {
  readonly todoId: number;
  readonly commentId: string;
  readonly userId: string;
}

interface UnlikeTodoCommentDependencies {
  readonly reader: Pick<TodoCommentReaderPort, "findAccessibleTodoOwnerId">;
  readonly repository: Pick<TodoCommentRepositoryPort, "findComment" | "removeLike">;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
}

export class UnlikeTodoComment {
  readonly #dependencies: UnlikeTodoCommentDependencies;

  constructor(dependencies: UnlikeTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UnlikeTodoCommentInput): Promise<TodoCommentLikeResponse> {
    const transition = await this.#dependencies.unitOfWork.run(async () => {
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
      return this.#dependencies.repository.removeLike(input.todoId, input.commentId, input.userId);
    });

    return {
      commentId: input.commentId,
      isLiked: false,
      likeCount: transition.likeCount,
    };
  }
}
