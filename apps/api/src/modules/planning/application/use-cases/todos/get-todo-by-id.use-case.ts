import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

/** 단일 Todo 조회 입력. */
export interface GetTodoByIdInput {
  id: number;
  userId: string;
}

interface GetTodoByIdDependencies {
  readonly todoReadRepository: TodoReadRepositoryPort;
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

    if (!todo) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: input.id });
    }

    return todo;
  }
}
