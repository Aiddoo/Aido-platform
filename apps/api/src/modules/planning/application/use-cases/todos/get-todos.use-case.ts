import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";
import { isAfter } from "#api/shared/domain/date/utils/compare";
import { ApplicationException } from "#api/shared/domain/index";

import type { FindTodosParams, GetTodosParams } from "../../models/todos/todo.types.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

/** Todo 목록 조회 입력. */
export type GetTodosInput = GetTodosParams;

interface GetTodosDependencies {
  readonly todoReadRepository: TodoReadRepositoryPort;
  readonly paginationService: PaginationService;
}

export class GetTodos {
  readonly #dependencies: GetTodosDependencies;

  constructor(dependencies: GetTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodosInput): Promise<CursorPaginatedResponse<TodoResponse, number>> {
    const params = input;

    if (params.startDate && params.endDate && isAfter(params.startDate, params.endDate)) {
      throw new ApplicationException(ErrorCode.SYS_0002, {
        message: "startDate must be less than or equal to endDate",
        startDate: params.startDate,
        endDate: params.endDate,
      });
    }

    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: params.cursor,
        size: params.size,
      },
    );

    const repoParams: FindTodosParams = {
      userId: params.userId,
      cursor,
      size,
      completed: params.completed,
      categoryId: params.categoryId,
      startDate: params.startDate,
      endDate: params.endDate,
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
