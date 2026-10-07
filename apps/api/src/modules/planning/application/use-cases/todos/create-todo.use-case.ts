import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/index";

import { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import type { CreateTodoData } from "../../models/todos/todo.types.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import type { TodoCreationEffects } from "../../services/todos/todo-creation-effects.service.js";
import type { TodoCreationWriter } from "../../services/todos/todo-creation-writer.service.js";

export type CreateTodoInput = CreateTodoData;

interface CreateTodoDependencies {
  readonly writer: Pick<TodoCreationWriter, "create">;
  readonly effects: Pick<TodoCreationEffects, "publishSingle">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
}

export class CreateTodo {
  readonly #dependencies: CreateTodoDependencies;

  constructor(dependencies: CreateTodoDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoInput): Promise<TodoResponse> {
    const draft = Todo.planCreation({
      userId: input.userId,
      categoryId: input.categoryId,
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      scheduledTime: input.scheduledTime,
      isAllDay: input.isAllDay,
      visibility: input.visibility,
    });

    const created = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoCategory(input.userId),
        MutationLockKeys.todoSortOrder(input.userId),
      ]);
      return this.#dependencies.writer.create(draft, input.items);
    });

    await this.#dependencies.effects.publishSingle(created, input.userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      created.getId().getValue(),
      input.userId,
    );
    if (response === null) {
      throw new ApplicationException(ErrorCode.TODO_0801, {
        todoId: created.getId().getValue(),
      });
    }
    return response;
  }
}
