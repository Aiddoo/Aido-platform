import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";

import { dateKeyOf } from "../../../shared/domain/todo-calendar.domain-service.js";
import { type FriendPort } from "../ports/friend.port.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import type { FindFriendTodosParams } from "../ports/todo-read.repository.port.js";
import type { FriendTodoReadModel } from "../read-models/todo.read-model.js";

export interface GetFriendTodosParams {
  readonly userId: string;
  readonly friendUserId: string;
  readonly cursor?: number;
  readonly size?: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}

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

export class ListFriendTodosUseCase {
  readonly #dependencies: GetFriendTodosDependencies;

  constructor(dependencies: GetFriendTodosDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: GetFriendTodosInput,
  ): Promise<CursorPaginatedResponse<FriendTodoReadModel, number>> {
    const { userId, friendUserId } = input;

    if (
      input.startDate != null &&
      input.endDate != null &&
      input.startDate.getTime() > input.endDate.getTime()
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

    const isFirstPage = cursor == null;
    const startDateKey = input.startDate != null ? dateKeyOf(input.startDate) : "-";
    const endDateKey = input.endDate != null ? dateKeyOf(input.endDate) : "-";
    let cacheGeneration: string | undefined;

    if (isFirstPage) {
      const cached = await this.#dependencies.todoCache.readFriendTodosFirstPage(
        friendUserId,
        startDateKey,
        endDateKey,
        size,
      );
      cacheGeneration = cached.generation;
      if (cached.page != null) {
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
      FriendTodoReadModel,
      number
    >({
      items,
      size,
    });

    if (isFirstPage && cacheGeneration != null) {
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
