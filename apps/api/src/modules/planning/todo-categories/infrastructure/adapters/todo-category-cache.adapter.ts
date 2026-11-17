import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  TodoCategoryCacheKey,
  TODO_CATEGORY_CACHE_TTL_MS,
} from "#api/modules/planning/todo-categories/infrastructure/cache/todo-category-cache.keyspace";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import {
  GenerationGuardedCache,
  type GenerationGuardedCacheKey,
} from "#api/platform/cache/generation-guarded-cache";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryCachePort } from "../../application/ports/todo-category-cache.port.js";
import type { TodoCategoryWithCountReadModel } from "../../application/read-models/todo-category-with-count.read-model.js";

const TODO_CATEGORY_LIST_SCHEMA = z.array(
  z.object({
    id: z.number(),
    userId: z.string(),
    name: z.string(),
    color: z.string(),
    sortOrder: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    todoCount: z.number(),
  }),
) satisfies z.ZodType<TodoCategoryWithCountReadModel[]>;

function listKey(userId: UserId): GenerationGuardedCacheKey {
  return {
    valueKey: TodoCategoryCacheKey.list(userId.value),
    generationKey: TodoCategoryCacheKey.listGeneration(userId.value),
  };
}

// 카테고리·할 일 쓰기의 커밋 전에 읽은 목록이 무효화 뒤 다시 저장되지 않도록 세대를 확인한다
@Injectable()
export class TodoCategoryCacheAdapter implements TodoCategoryCachePort {
  readonly #lists: GenerationGuardedCache;

  constructor(cacheService: CacheStorePort) {
    this.#lists = new GenerationGuardedCache(cacheService, TODO_CATEGORY_CACHE_TTL_MS);
  }

  wrapList(
    userId: UserId,
    factory: () => Promise<TodoCategoryWithCountReadModel[]>,
  ): Promise<TodoCategoryWithCountReadModel[]> {
    return this.#lists.wrap(
      listKey(userId),
      TODO_CATEGORY_LIST_SCHEMA,
      factory,
      TODO_CATEGORY_CACHE_TTL_MS,
    );
  }

  invalidate(userId: UserId): Promise<void> {
    return this.#lists.invalidate(listKey(userId));
  }
}
