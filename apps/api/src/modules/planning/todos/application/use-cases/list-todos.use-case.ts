import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import type { CatchUpTodoSeriesUseCase } from "../../../todo-series/application/use-cases/catch-up-todo-series.use-case.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import type { FindTodosParams } from "../ports/todo-read.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { invalidDateRange } from "../todos.errors.js";

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
  readonly seriesCatchUp: Pick<CatchUpTodoSeriesUseCase, "execute">;
}

export class ListTodosUseCase {
  readonly #dependencies: GetTodosDependencies;

  constructor(dependencies: GetTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodosInput): Promise<CursorPage<TodoReadModel, number>> {
    if (
      input.startDate != null &&
      input.endDate != null &&
      Temporal.PlainDate.compare(input.startDate, input.endDate) > 0
    ) {
      throw invalidDateRange(input.startDate, input.endDate);
    }

    await this.#dependencies.seriesCatchUp.execute(input.userId);

    const cursor = input.cursor;
    const size = clampPageSize(input.size);

    const repoParams: FindTodosParams = {
      userId: UserId.reconstitute(input.userId),
      cursor,
      size,
      completed: input.completed,
      categoryId:
        input.categoryId == null ? undefined : TodoCategoryId.reconstitute(input.categoryId),
      startDate: input.startDate,
      endDate: input.endDate,
    };

    const rows = await this.#dependencies.todoReadRepository.findManyByUserId(repoParams);

    return toCursorPage({ rows, size, toCursor: (todo) => todo.id });
  }
}
