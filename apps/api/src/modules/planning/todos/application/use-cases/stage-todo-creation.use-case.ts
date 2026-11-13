import { toTodoSeriesReadModel } from "../../../todo-series/application/read-models/todo-series.read-model.js";
import type { PublishTodoCreationUseCase } from "../../../todo-series/application/use-cases/publish-todo-creation.use-case.js";
import type {
  CreateTodoData,
  ResolvedCreateTodoData,
  StagedTodoCreation,
} from "../ports/staged-todo-creator.port.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { todoNotFound } from "../todos.errors.js";
import type { ResolveTodoTimezoneUseCase } from "./resolve-todo-timezone.use-case.js";
import { toSingleTodoSpec, type WriteTodoCreationUseCase } from "./write-todo-creation.use-case.js";

interface StagedTodoCreatorDependencies {
  readonly writer: Pick<WriteTodoCreationUseCase, "createSingle" | "startSeries">;
  readonly effects: Pick<PublishTodoCreationUseCase, "publishSingle" | "publishSeriesStarted">;
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
    const created = await this.#dependencies.writer.createSingle(
      toSingleTodoSpec(input),
      input.items,
    );
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
      afterCommit: () => this.#dependencies.effects.publishSingle(created.todo),
    };
  }

  async #stageSeries(
    input: ResolvedCreateTodoData,
    repeat: NonNullable<CreateTodoData["repeat"]>,
  ): Promise<StagedTodoCreation> {
    const { series, occurrences } = await this.#dependencies.writer.startSeries(input, repeat);
    const todos = await this.#dependencies.todoReadRepository.findManyBySeriesId(
      input.userId,
      series.id,
    );
    return {
      todos,
      series: toTodoSeriesReadModel(series),
      afterCommit: () => this.#dependencies.effects.publishSeriesStarted(series, occurrences),
    };
  }
}
