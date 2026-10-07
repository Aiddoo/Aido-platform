import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import { Todo } from "../../../domain/aggregates/todos/todo.aggregate.js";
import type { CreateTodoData, CreateRecurringTodoData } from "../../models/todos/todo.types.js";
import type {
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "../../ports/todos/staged-todo-creator.port.js";
import type { TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import type { TodoCreationEffects } from "./todo-creation-effects.service.js";
import {
  planRecurringTodoCreation,
  type TodoCreationWriter,
} from "./todo-creation-writer.service.js";

interface StagedTodoCreatorDependencies {
  readonly writer: Pick<TodoCreationWriter, "create" | "createRecurring">;
  readonly effects: Pick<TodoCreationEffects, "publishSingle" | "publishRecurring">;
  readonly todoReadRepository: Pick<
    TodoReadRepositoryPort,
    "findByIdAndUserId" | "findManyByRecurrenceGroupId"
  >;
}

export class StagedTodoCreator implements StagedTodoCreatorPort {
  readonly #dependencies: StagedTodoCreatorDependencies;

  constructor(dependencies: StagedTodoCreatorDependencies) {
    this.#dependencies = dependencies;
  }

  async stageTodo(input: CreateTodoData): Promise<StagedTodoCreation> {
    const draft = Todo.planCreation(input);
    const created = await this.#dependencies.writer.create(draft, input.items);
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      created.getId().getValue(),
      input.userId,
    );
    if (response === null)
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: created.getId().getValue() });
    return {
      todos: [response],
      afterCommit: () => this.#dependencies.effects.publishSingle(created, input.userId),
    };
  }

  async stageRecurringTodos(
    input: CreateRecurringTodoData,
    timezone: string,
  ): Promise<StagedTodoCreation> {
    const plan = planRecurringTodoCreation(input, timezone);
    const created = await this.#dependencies.writer.createRecurring(plan);
    const todos = await this.#dependencies.todoReadRepository.findManyByRecurrenceGroupId(
      input.userId,
      plan.recurrenceGroupId,
    );
    return {
      todos,
      afterCommit: () =>
        this.#dependencies.effects.publishRecurring(created, input.userId, plan.recurrenceGroupId),
    };
  }
}
