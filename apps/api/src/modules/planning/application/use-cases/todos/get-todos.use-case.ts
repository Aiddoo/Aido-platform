import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";
import { isAfter } from "#api/shared/domain/date/utils/compare";
import { ApplicationException } from "#api/shared/domain/index";

import type { FindTodosParams, GetTodosParams } from "../../models/todos/todo.types.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

export type GetTodosInput = GetTodosParams;

interface GetTodosDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findManyByUserId">;
  readonly paginationService: PaginationService;
}

export class GetTodos {
  readonly #dependencies: GetTodosDependencies;

  constructor(dependencies: GetTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodosInput): Promise<CursorPaginatedResponse<TodoResponse, number>> {
    if (
      input.startDate !== undefined &&
      input.endDate !== undefined &&
      isAfter(input.startDate, input.endDate)
    ) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        message: "startDate must be less than or equal to endDate",
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }

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

    return this.#dependencies.paginationService.createCursorPaginatedResponse<TodoResponse, number>(
      {
        items,
        size,
      },
    );
  }
}
