import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/index";

import type { CreateTodoData } from "../../models/todos/todo.types.js";
import type {
  StagedTodoCreation,
  StagedTodoCreatorPort,
} from "../../ports/todos/staged-todo-creator.port.js";
import type { TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { toTodoSeriesResponse } from "../../read-models/series/todo-series.read-model.js";
import type { TodoCreationEffects } from "./todo-creation-effects.service.js";
import { planTodoCreation, type TodoCreationWriter } from "./todo-creation-writer.service.js";

interface StagedTodoCreatorDependencies {
  readonly writer: Pick<TodoCreationWriter, "createSingle" | "startSeries">;
  readonly effects: Pick<TodoCreationEffects, "publishSingle" | "publishSeriesStarted">;
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
    return input.repeat == null ? this.#stageSingle(input) : this.#stageSeries(input, input.repeat);
  }

  async #stageSingle(input: CreateTodoData): Promise<StagedTodoCreation> {
    const created = await this.#dependencies.writer.createSingle(
      planTodoCreation(input),
      input.items,
    );
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      created.getId().getValue(),
      input.userId,
    );
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: created.getId().getValue() });
    }
    return {
      todos: [response],
      series: null,
      afterCommit: () => this.#dependencies.effects.publishSingle(created, input.userId),
    };
  }

  async #stageSeries(
    input: CreateTodoData,
    repeat: NonNullable<CreateTodoData["repeat"]>,
  ): Promise<StagedTodoCreation> {
    const { series, occurrences } = await this.#dependencies.writer.startSeries(input, repeat);
    const todos = await this.#dependencies.todoReadRepository.findManyBySeriesId(
      input.userId,
      series.getId(),
    );
    return {
      todos,
      series: toTodoSeriesResponse(series),
      afterCommit: () => this.#dependencies.effects.publishSeriesStarted(series, occurrences),
    };
  }
}
