import type { TodoSeriesResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { TodoSeriesRepositoryPort } from "../ports/todo-series.repository.port.js";
import { toTodoSeriesResponse } from "../read-models/todo-series.read-model.js";

export interface GetTodoSeriesInput {
  readonly seriesId: string;
  readonly userId: string;
}

interface GetTodoSeriesDependencies {
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "findByIdAndUserId">;
}

export class GetTodoSeries {
  readonly #dependencies: GetTodoSeriesDependencies;

  constructor(dependencies: GetTodoSeriesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoSeriesInput): Promise<TodoSeriesResponse> {
    const series = await this.#dependencies.seriesRepository.findByIdAndUserId(
      input.seriesId,
      input.userId,
    );
    if (series == null) {
      throw new ApplicationException(ErrorCode.TODO_0841, { seriesId: input.seriesId });
    }
    return toTodoSeriesResponse(series);
  }
}
