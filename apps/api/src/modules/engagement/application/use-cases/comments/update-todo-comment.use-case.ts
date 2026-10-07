import type { TodoCommentMutationResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/index";

import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import { type TodoCommentRepositoryPort } from "../../ports/comments/todo-comment.repository.port.js";
import { toTodoCommentResponse } from "../../presenters/comments/index.js";
import { assertTodoCommentAccess } from "../../services/comments/assert-todo-comment-access.js";

export interface UpdateTodoCommentInput {
  todoId: number;
  commentId: string;
  userId: string;
  content: string;
}

interface UpdateTodoCommentDependencies {
  readonly reader: TodoCommentReaderPort;
  readonly repository: TodoCommentRepositoryPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
}

export class UpdateTodoComment {
  readonly #dependencies: UpdateTodoCommentDependencies;

  constructor(dependencies: UpdateTodoCommentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoCommentInput): Promise<TodoCommentMutationResponse> {
    return this.#dependencies.unitOfWork.run(async () => {
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

      comment.edit(input.userId, input.content, now());
      if (!(await this.#dependencies.repository.updateComment(comment))) {
        throw new ApplicationException(ErrorCode.SYS_0003, { commentId: input.commentId });
      }

      const updatedComment = await this.#dependencies.reader.findCommentRecord(
        input.todoId,
        input.commentId,
      );
      if (updatedComment === null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      const likedIds = await this.#dependencies.reader.findLikedCommentIds(
        [input.commentId],
        input.userId,
      );
      return { comment: toTodoCommentResponse(updatedComment, input.userId, likedIds) };
    });
  }
}
