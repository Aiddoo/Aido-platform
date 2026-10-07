import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

export interface GetTodoByIdInput {
  readonly id: number;
  readonly userId: string;
}

interface GetTodoByIdDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
}

export class GetTodoById {
  readonly #dependencies: GetTodoByIdDependencies;

  constructor(dependencies: GetTodoByIdDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoByIdInput): Promise<TodoResponse> {
    const todo = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      input.id,
      input.userId,
    );

    if (todo === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: input.id });
    }

    return todo;
  }
}
