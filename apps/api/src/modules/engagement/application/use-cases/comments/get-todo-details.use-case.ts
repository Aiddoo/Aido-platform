import type { TodoDetailsResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { getTodoDetailsPermissions } from "../../../domain/policies/comments/todo-comment-permission.policy.js";
import { type TodoCommentReaderPort } from "../../ports/comments/todo-comment.reader.port.js";
import { type TodoCommentRepositoryPort } from "../../ports/comments/todo-comment.repository.port.js";

export interface GetTodoDetailsInput {
  readonly todoId: number;
  readonly viewerId: string;
}

interface GetTodoDetailsDependencies {
  readonly todoCommentReader: Pick<TodoCommentReaderPort, "findAccessibleTodoDetails">;
  readonly todoCommentRepository: Pick<TodoCommentRepositoryPort, "recordView">;
  readonly unitOfWork: UnitOfWorkPort;
}

export class GetTodoDetails {
  readonly #dependencies: GetTodoDetailsDependencies;

  constructor(dependencies: GetTodoDetailsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoDetailsInput): Promise<TodoDetailsResponse> {
    return this.#dependencies.unitOfWork.run(async () => {
      const todoDetails = await this.#dependencies.todoCommentReader.findAccessibleTodoDetails(
        input.todoId,
        input.viewerId,
      );

      if (todoDetails === null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: input.todoId });
      }

      const viewCount = todoDetails.isOwner
        ? todoDetails.viewCount
        : (await this.#dependencies.todoCommentRepository.recordView(input.todoId, input.viewerId))
            .viewCount;

      return {
        todo: todoDetails.todo,
        owner: todoDetails.owner,
        permissions: getTodoDetailsPermissions(todoDetails.isOwner),
        metrics: {
          viewCount,
          commentCount: todoDetails.commentCount,
        },
      };
    });
  }
}
