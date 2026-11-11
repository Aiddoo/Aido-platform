import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoId } from "../../../shared/domain/todo-id.vo.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";

export interface GetTodoByIdInput {
  readonly id: number;
  readonly userId: string;
}

interface GetTodoByIdDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
}

export class GetTodoUseCase {
  readonly #dependencies: GetTodoByIdDependencies;

  constructor(dependencies: GetTodoByIdDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoByIdInput): Promise<TodoReadModel> {
    const todo = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      TodoId.reconstitute(input.id),
      UserId.reconstitute(input.userId),
    );

    if (todo == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: input.id });
    }

    return todo;
  }
}
