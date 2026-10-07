import type { TodoCommentMutationResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { Inject, Injectable } from "@nestjs/common";

import {
  MUTATION_LOCK,
  MutationLockKeys,
  type MutationLockPort,
  UNIT_OF_WORK,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/index";

import { assertTodoCommentAccess } from "../../assert-todo-comment-access.js";
import {
  TODO_COMMENT_READER,
  type TodoCommentReaderPort,
} from "../../ports/todo-comment.reader.port.js";
import {
  TODO_COMMENT_REPOSITORY,
  type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port.js";
import { toTodoCommentResponse } from "../../presenters/index.js";

export interface UpdateTodoCommentInput {
  todoId: number;
  commentId: string;
  userId: string;
  content: string;
}

@Injectable()
export class UpdateTodoCommentUseCase {
  constructor(
    @Inject(TODO_COMMENT_READER)
    private readonly reader: TodoCommentReaderPort,
    @Inject(TODO_COMMENT_REPOSITORY)
    private readonly repository: TodoCommentRepositoryPort,
    @Inject(MUTATION_LOCK)
    private readonly mutationLock: MutationLockPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: UpdateTodoCommentInput): Promise<TodoCommentMutationResponse> {
    return this.unitOfWork.run(async () => {
      await this.mutationLock.acquire([MutationLockKeys.todoComment(input.commentId)]);
      await assertTodoCommentAccess(this.reader, input.todoId, input.userId);
      const comment = await this.repository.findComment(input.todoId, input.commentId);

      if (comment === null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      comment.edit(input.userId, input.content, now());
      if (!(await this.repository.updateComment(comment))) {
        throw new ApplicationException(ErrorCode.SYS_0003, { commentId: input.commentId });
      }

      const updatedComment = await this.reader.findCommentRecord(input.todoId, input.commentId);
      if (updatedComment === null) {
        throw new ApplicationException(ErrorCode.TODO_0831, { commentId: input.commentId });
      }

      const likedIds = await this.reader.findLikedCommentIds([input.commentId], input.userId);
      return { comment: toTodoCommentResponse(updatedComment, input.userId, likedIds) };
    });
  }
}
