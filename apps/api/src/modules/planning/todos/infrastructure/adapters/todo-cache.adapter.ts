import { randomUUID } from "node:crypto";

import { friendTodoSchema } from "@aido/api";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { TodoCategoryCacheKey } from "#api/modules/planning/categories/infrastructure/cache/todo-category-cache.keyspace";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  FriendTodosFirstPageCacheRead,
  TodoCachePort,
} from "../../application/ports/todo-cache.port.js";
import type { FriendTodoReadModel } from "../../application/read-models/todo.read-model.js";
import {
  FRIEND_TODOS_INITIAL_GENERATION,
  TODO_CACHE_TTL_MS,
  TodoCacheKey,
} from "../cache/todo-cache.keyspace.js";

// 1.15.1 전에 담은 응답 모양 값은 seriesId가 없어 parse에 실패하고 미스로 읽힌다
const friendTodoReadModelSchema = friendTodoSchema
  .omit({ content: true, itemStats: true, recurrenceGroupId: true })
  .extend({ seriesId: z.string().nullable(), scheduledLocalTime: z.string().nullable() });

const FRIEND_TODOS_PAGE_SCHEMA = z.object({
  items: z.array(friendTodoReadModelSchema),
  pagination: z.object({
    nextCursor: z.number().nullable(),
    hasNext: z.boolean(),
    size: z.number(),
  }),
}) satisfies z.ZodType<CursorPaginatedResponse<FriendTodoReadModel, number>>;

/**
 * Todo 캐시 포트 어댑터 — CacheStorePort에 위임
 */
@Injectable()
export class TodoCacheAdapter implements TodoCachePort {
  readonly #cacheService: CacheStorePort;

  constructor(cacheService: CacheStorePort) {
    this.#cacheService = cacheService;
  }

  async invalidateTodoCategories(userId: UserId): Promise<void> {
    await this.#cacheService.del(TodoCategoryCacheKey.list(userId.value));
  }

  async readFriendTodosFirstPage(
    ownerUserId: UserId,
    startDate: string,
    endDate: string,
    size: number,
  ): Promise<FriendTodosFirstPageCacheRead> {
    const generation = await this.#getFriendTodosGeneration(ownerUserId);
    const page = await this.#cacheService.get(
      TodoCacheKey.friendTodosFirstPageVersioned(
        ownerUserId.value,
        generation,
        startDate,
        endDate,
        size,
      ),
      FRIEND_TODOS_PAGE_SCHEMA,
    );
    // page GET이 끝난 뒤 다시 읽어야 둘 사이의 invalidate를 반드시 관측한다.
    const verifiedGeneration = await this.#getFriendTodosGeneration(ownerUserId);

    // generation이 바뀐 동안 읽은 이전 페이지는 cache miss로 취급한다.
    if (verifiedGeneration !== generation) {
      return { generation: verifiedGeneration, page: undefined };
    }

    return { generation, page };
  }

  async storeFriendTodosFirstPageIfCurrent(
    ownerUserId: UserId,
    startDate: string,
    endDate: string,
    size: number,
    generation: string,
    page: CursorPaginatedResponse<FriendTodoReadModel, number>,
  ): Promise<void> {
    const currentGeneration = await this.#getFriendTodosGeneration(ownerUserId);
    if (currentGeneration !== generation) {
      return;
    }

    // 확인 직후 invalidate가 와도 이전 generation 키에만 저장되어 새 reader에는 보이지 않는다.
    await this.#cacheService.set(
      TodoCacheKey.friendTodosFirstPageVersioned(
        ownerUserId.value,
        generation,
        startDate,
        endDate,
        size,
      ),
      page,
      TODO_CACHE_TTL_MS.FRIEND_VIEW,
    );
  }

  async invalidateFriendTodos(ownerUserId: UserId): Promise<void> {
    const previousGeneration = await this.#getFriendTodosGeneration(ownerUserId);

    // 먼저 generation을 회전해야 진행 중인 reader가 이전 페이지를 다시 채워도 보이지 않는다.
    await this.#cacheService.set(
      TodoCacheKey.friendTodosGeneration(ownerUserId.value),
      randomUUID(),
      TODO_CACHE_TTL_MS.FRIEND_VIEW_GENERATION,
    );

    await Promise.all([
      this.#cacheService.delByPattern(
        TodoCacheKey.friendTodosGenerationPattern(ownerUserId.value, previousGeneration),
      ),
      // v1은 더 이상 읽지 않지만 롤링 배포 중인 이전 인스턴스와 잔존 키를 함께 정리한다.
      this.#cacheService.delByPattern(TodoCacheKey.friendTodosPattern(ownerUserId.value)),
    ]);
  }

  async #getFriendTodosGeneration(ownerUserId: UserId): Promise<string> {
    return (
      (await this.#cacheService.get(
        TodoCacheKey.friendTodosGeneration(ownerUserId.value),
        z.string(),
      )) ?? FRIEND_TODOS_INITIAL_GENERATION
    );
  }
}
