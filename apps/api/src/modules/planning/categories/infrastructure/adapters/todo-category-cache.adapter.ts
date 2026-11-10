import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  TodoCategoryCacheKey,
  TODO_CATEGORY_CACHE_TTL_MS,
} from "#api/modules/planning/categories/infrastructure/cache/todo-category-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";

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

/**
 * TodoCategoryCachePort의 어댑터 — 공유 CacheService에 위임한다(키·TTL은 CacheService가 소유).
 */
@Injectable()
export class TodoCategoryCacheAdapter implements TodoCategoryCachePort {
  readonly #cacheService: CacheService;

  constructor(cacheService: CacheService) {
    this.#cacheService = cacheService;
  }

  wrapList(
    userId: string,
    factory: () => Promise<TodoCategoryWithCountReadModel[]>,
  ): Promise<TodoCategoryWithCountReadModel[]> {
    return this.#cacheService.wrap(
      TodoCategoryCacheKey.list(userId),
      TODO_CATEGORY_LIST_SCHEMA,
      factory,
      TODO_CATEGORY_CACHE_TTL_MS,
    );
  }

  invalidate(userId: string): Promise<void> {
    return this.#cacheService.del(TodoCategoryCacheKey.list(userId));
  }
}
