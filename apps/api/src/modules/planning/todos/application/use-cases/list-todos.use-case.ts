import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";

import type { CatchUpTodoSeriesUseCase } from "../../../todo-series/application/use-cases/catch-up-todo-series.use-case.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import type { FindTodosParams } from "../ports/todo-read.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";

interface GetTodosParams {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
  readonly completed?: boolean;
  readonly categoryId?: number;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate;
}

export type GetTodosInput = GetTodosParams;

interface GetTodosDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findManyByUserId">;
  readonly paginationService: PaginationService;
  readonly seriesCatchUp: Pick<CatchUpTodoSeriesUseCase, "execute">;
}

export class ListTodosUseCase {
  readonly #dependencies: GetTodosDependencies;

  constructor(dependencies: GetTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodosInput): Promise<CursorPaginatedResponse<TodoReadModel, number>> {
    if (
      input.startDate != null &&
      input.endDate != null &&
      Temporal.PlainDate.compare(input.startDate, input.endDate) > 0
    ) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        message: "startDate must be less than or equal to endDate",
        startDate: input.startDate.toString(),
        endDate: input.endDate.toString(),
      });
    }

    await this.#dependencies.seriesCatchUp.execute(input.userId);

    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: input.cursor,
        size: input.size,
      },
    );

    const repoParams: FindTodosParams = {
      userId: input.userId,
      cursor,
      size,
      completed: input.completed,
      categoryId: input.categoryId,
      startDate: input.startDate,
      endDate: input.endDate,
    };

    const items = await this.#dependencies.todoReadRepository.findManyByUserId(repoParams);

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      TodoReadModel,
      number
    >({
      items,
      size,
    });
  }
}
