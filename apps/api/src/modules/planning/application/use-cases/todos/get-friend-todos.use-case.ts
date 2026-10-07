import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";
import { isAfter } from "#api/shared/domain/date/utils/compare";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/index";

import type { FindFriendTodosParams, GetFriendTodosParams } from "../../models/todos/todo.types.js";
import { type FriendPort } from "../../ports/todos/friend.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

export type GetFriendTodosInput = GetFriendTodosParams;

interface GetFriendTodosDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findPublicTodosByUserId">;
  readonly paginationService: PaginationService;
  readonly friendPort: Pick<FriendPort, "isMutualFriend">;
  readonly todoCache: Pick<
    TodoCachePort,
    "readFriendTodosFirstPage" | "storeFriendTodosFirstPageIfCurrent"
  >;
}

export class GetFriendTodos {
  readonly #dependencies: GetFriendTodosDependencies;

  constructor(dependencies: GetFriendTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: GetFriendTodosInput,
  ): Promise<CursorPaginatedResponse<TodoResponse, number>> {
    const { userId, friendUserId } = input;

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

    const isMutualFriend = await this.#dependencies.friendPort.isMutualFriend(userId, friendUserId);
    if (!isMutualFriend) {
      throw new ApplicationException(ErrorCode.FOLLOW_0906, {
        targetUserId: friendUserId,
      });
    }

    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: input.cursor,
        size: input.size,
      },
    );

    const isFirstPage = cursor === undefined;
    const startDateKey = input.startDate !== undefined ? toDateString(input.startDate) : "-";
    const endDateKey = input.endDate !== undefined ? toDateString(input.endDate) : "-";
    let cacheGeneration: string | undefined;

    if (isFirstPage) {
      const cached = await this.#dependencies.todoCache.readFriendTodosFirstPage(
        friendUserId,
        startDateKey,
        endDateKey,
        size,
      );
      cacheGeneration = cached.generation;
      if (cached.page !== undefined) {
        return cached.page;
      }
    }

    const repoParams: FindFriendTodosParams = {
      friendUserId,
      cursor,
      size,
      startDate: input.startDate,
      endDate: input.endDate,
    };

    const items = await this.#dependencies.todoReadRepository.findPublicTodosByUserId(repoParams);

    const response = this.#dependencies.paginationService.createCursorPaginatedResponse<
      TodoResponse,
      number
    >({
      items,
      size,
    });

    if (isFirstPage && cacheGeneration !== undefined) {
      await this.#dependencies.todoCache.storeFriendTodosFirstPageIfCurrent(
        friendUserId,
        startDateKey,
        endDateKey,
        size,
        cacheGeneration,
        response,
      );
    }

    return response;
  }
}
