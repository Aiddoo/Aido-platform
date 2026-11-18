import { toTodoSeriesReadModel } from "#api/modules/planning/todo-series/planning-todo-series.public";
import type { PublishTodoSeriesStartedUseCase } from "#api/modules/planning/todo-series/planning-todo-series.public";

import type {
  CreateTodoData,
  ResolvedCreateTodoData,
  StagedTodoCreation,
} from "../ports/staged-todo-creator.port.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { todoNotFound } from "../todos.errors.js";
import type { PublishTodoCreatedUseCase } from "./publish-todo-created.use-case.js";
import type { ResolveTodoTimezoneUseCase } from "./resolve-todo-timezone.use-case.js";
import { toSingleTodoSpec, type WriteSingleTodoUseCase } from "./write-single-todo.use-case.js";
import type { WriteTodoSeriesUseCase } from "./write-todo-series.use-case.js";

interface StagedTodoCreatorDependencies {
  readonly writeSingle: Pick<WriteSingleTodoUseCase, "execute">;
  readonly writeSeries: Pick<WriteTodoSeriesUseCase, "execute">;
  readonly publishCreated: Pick<PublishTodoCreatedUseCase, "execute">;
  readonly publishSeriesStarted: Pick<PublishTodoSeriesStartedUseCase, "execute">;
  readonly todoReadRepository: Pick<
    TodoReadRepositoryPort,
    "findByIdAndUserId" | "findManyBySeriesId"
  >;
  readonly timezoneResolver: Pick<ResolveTodoTimezoneUseCase, "execute">;
}

export class StageTodoCreationUseCase {
  readonly #dependencies: StagedTodoCreatorDependencies;

  constructor(dependencies: StagedTodoCreatorDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateTodoData): Promise<StagedTodoCreation> {
    const timezone = await this.#dependencies.timezoneResolver.execute(
      input.userId.value,
      input.timezone,
    );
    const resolved = { ...input, timezone };
    return resolved.repeat == null
      ? this.#stageSingle(resolved)
      : this.#stageSeries(resolved, resolved.repeat);
  }

  async #stageSingle(input: ResolvedCreateTodoData): Promise<StagedTodoCreation> {
    const created = await this.#dependencies.writeSingle.execute({
      spec: toSingleTodoSpec(input),
      items: input.items,
    });
    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(
      created.todo.id,
      input.userId,
    );
    if (response == null) {
      throw todoNotFound(created.todo.id.value);
    }
    return {
      todos: [response],
      series: null,
      afterCommit: () => this.#dependencies.publishCreated.execute(created.todo),
    };
  }

  async #stageSeries(
    input: ResolvedCreateTodoData,
    repeat: NonNullable<CreateTodoData["repeat"]>,
  ): Promise<StagedTodoCreation> {
    const started = await this.#dependencies.writeSeries.execute({ data: input, repeat });
    const todos = await this.#dependencies.todoReadRepository.findManyBySeriesId(
      input.userId,
      started.series.id,
    );
    return {
      todos,
      series: toTodoSeriesReadModel(started.series),
      afterCommit: () => this.#dependencies.publishSeriesStarted.execute(started),
    };
  }
}
