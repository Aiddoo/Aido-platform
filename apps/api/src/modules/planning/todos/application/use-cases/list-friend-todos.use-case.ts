import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type FriendPort } from "../ports/friend.port.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import type { FindFriendTodosParams } from "../ports/todo-read.repository.port.js";
import type { FriendTodoReadModel } from "../read-models/todo.read-model.js";
import { friendTodosForbidden, invalidDateRange } from "../todos.errors.js";

interface GetFriendTodosParams {
  readonly userId: string;
  readonly friendUserId: string;
  readonly cursor?: number;
  readonly size?: number;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate;
}

export type GetFriendTodosInput = GetFriendTodosParams;

interface GetFriendTodosDependencies {
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findPublicTodosByUserId">;
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

  async execute(input: GetFriendTodosInput): Promise<CursorPage<FriendTodoReadModel, number>> {
    const { userId, friendUserId } = input;
    const viewerId = UserId.reconstitute(userId);
    const friendId = UserId.reconstitute(friendUserId);

    if (
      input.startDate != null &&
      input.endDate != null &&
      Temporal.PlainDate.compare(input.startDate, input.endDate) > 0
    ) {
      throw invalidDateRange(input.startDate, input.endDate);
    }

    const isMutualFriend = await this.#dependencies.friendPort.isMutualFriend(viewerId, friendId);
    if (!isMutualFriend) {
      throw friendTodosForbidden(friendUserId);
    }

    const cursor = input.cursor;
    const size = clampPageSize(input.size);

    const isFirstPage = cursor == null;
    const pageKey = {
      ownerUserId: friendId,
      startDate: input.startDate?.toString() ?? "-",
      endDate: input.endDate?.toString() ?? "-",
      size,
    };
    let cacheGeneration: string | undefined;

    if (isFirstPage) {
      const cached = await this.#dependencies.todoCache.readFriendTodosFirstPage(pageKey);
      cacheGeneration = cached.generation;
      if (cached.page != null) {
        return cached.page;
      }
    }

    const repositoryQuery: FindFriendTodosParams = {
      friendUserId: friendId,
      cursor,
      size,
      startDate: input.startDate,
      endDate: input.endDate,
    };

    const rows =
      await this.#dependencies.todoReadRepository.findPublicTodosByUserId(repositoryQuery);

    const response = toCursorPage({ rows, size, toCursor: (todo) => todo.id });

    if (isFirstPage && cacheGeneration != null) {
      await this.#dependencies.todoCache.storeFriendTodosFirstPageIfCurrent(
        pageKey,
        cacheGeneration,
        response,
      );
    }

    return response;
  }
}
