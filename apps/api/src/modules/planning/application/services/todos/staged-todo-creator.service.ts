import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import type { CreateTodoData, TodoRecurrence } from "../../models/todos/todo.types.js";
import type {
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "../../ports/todos/staged-todo-creator.port.js";
import type { TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import type { TodoCreationEffects } from "./todo-creation-effects.service.js";
import {
  planRecurringTodoCreation,
  planTodoCreation,
  type TodoCreationWriter,
} from "./todo-creation-writer.service.js";

interface StagedTodoCreatorDependencies {
  readonly writer: Pick<TodoCreationWriter, "create" | "createRecurring">;
  readonly effects: Pick<TodoCreationEffects, "publishSingle" | "publishRecurring">;
  readonly todoReadRepository: Pick<
    TodoReadRepositoryPort,
    "findByIdAndUserId" | "findManyBySeriesId"
  >;
}

export class StagedTodoCreator implements StagedTodoCreatorPort {
  readonly #dependencies: StagedTodoCreatorDependencies;

  constructor(dependencies: StagedTodoCreatorDependencies) {
    this.#dependencies = dependencies;
  }

  stage(input: CreateTodoData): Promise<StagedTodoCreation> {
    return input.recurrence == null
      ? this.#stageSingle(input)
      : this.#stageRecurring(input, input.recurrence);
  }

  async #stageSingle(input: CreateTodoData): Promise<StagedTodoCreation> {
    const created = await this.#dependencies.writer.create(planTodoCreation(input), input.items);
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      created.getId().getValue(),
      input.userId,
    );
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: created.getId().getValue() });
    }
    return {
      todos: [response],
      afterCommit: () => this.#dependencies.effects.publishSingle(created, input.userId),
    };
  }

  async #stageRecurring(
    input: CreateTodoData,
    recurrence: TodoRecurrence,
  ): Promise<StagedTodoCreation> {
    const plan = planRecurringTodoCreation(input, recurrence);
    const created = await this.#dependencies.writer.createRecurring(plan);
    const todos = await this.#dependencies.todoReadRepository.findManyBySeriesId(
      input.userId,
      plan.seriesId,
    );
    return {
      todos,
      afterCommit: () =>
        this.#dependencies.effects.publishRecurring(created, input.userId, plan.seriesId),
    };
  }
}
