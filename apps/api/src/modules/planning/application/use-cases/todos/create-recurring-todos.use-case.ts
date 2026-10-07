import type { Todo as TodoResponse } from "@aido/api";

import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import type { CreateRecurringTodoData } from "../../models/todos/todo.types.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import type { TodoCreationEffects } from "../../services/todos/todo-creation-effects.service.js";
import {
  planRecurringTodoCreation,
  type TodoCreationWriter,
} from "../../services/todos/todo-creation-writer.service.js";

export interface CreateRecurringTodosResult {
  readonly todos: TodoResponse[];
  readonly count: number;
}

export interface CreateRecurringTodosInput {
  readonly data: CreateRecurringTodoData;
  readonly timezone: string;
}

interface CreateRecurringTodosDependencies {
  readonly writer: Pick<TodoCreationWriter, "createRecurring">;
  readonly effects: Pick<TodoCreationEffects, "publishRecurring">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findManyByRecurrenceGroupId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
}

export class CreateRecurringTodos {
  readonly #dependencies: CreateRecurringTodosDependencies;

  constructor(dependencies: CreateRecurringTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateRecurringTodosInput): Promise<CreateRecurringTodosResult> {
    const { data, timezone } = input;

    const plan = planRecurringTodoCreation(data, timezone);
    const created = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([
        MutationLockKeys.todoCategory(data.userId),
        MutationLockKeys.todoSortOrder(data.userId),
      ]);
      return this.#dependencies.writer.createRecurring(plan);
    });

    await this.#dependencies.effects.publishRecurring(created, data.userId, plan.recurrenceGroupId);

    const todos = await this.#dependencies.todoReadRepository.findManyByRecurrenceGroupId(
      data.userId,
      plan.recurrenceGroupId,
    );

    return { todos, count: plan.dates.length };
  }
}
