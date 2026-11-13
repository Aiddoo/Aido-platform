import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoSeriesId } from "../../domain/todo-series-id.vo.js";
import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import {
  toTodoSeriesReadModel,
  type TodoSeriesReadModel,
} from "../read-models/todo-series.read-model.js";
import { todoSeriesNotFound } from "../todo-series.errors.js";

export interface GetTodoSeriesInput {
  readonly seriesId: string;
  readonly userId: string;
}

interface GetTodoSeriesDependencies {
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "findByIdAndUserId">;
}

export class GetTodoSeriesUseCase {
  readonly #dependencies: GetTodoSeriesDependencies;

  constructor(dependencies: GetTodoSeriesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoSeriesInput): Promise<TodoSeriesReadModel> {
    const series = await this.#dependencies.seriesRepository.findByIdAndUserId(
      TodoSeriesId.reconstitute(input.seriesId),
      UserId.reconstitute(input.userId),
    );
    if (series == null) {
      throw todoSeriesNotFound(input.seriesId);
    }
    return toTodoSeriesReadModel(series);
  }
}
