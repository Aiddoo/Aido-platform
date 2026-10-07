import { Injectable } from "@nestjs/common";

import {
  TodoCategoryCacheKey,
  TODO_CATEGORY_CACHE_TTL_MS,
} from "#api/modules/planning/infrastructure/cache/categories/todo-category-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";

import type { TodoCategoryCachePort } from "../../../application/ports/categories/todo-category-cache.port.js";
import type { TodoCategoryWithCountView } from "../../../application/ports/categories/todo-category.repository.port.js";

/**
 * TodoCategoryCachePort의 어댑터 — 공유 CacheService에 위임한다(키·TTL은 CacheService가 소유).
 */
@Injectable()
export class TodoCategoryCacheAdapter implements TodoCategoryCachePort {
  constructor(private readonly cacheService: CacheService) {}

  wrapList(
    userId: string,
    factory: () => Promise<TodoCategoryWithCountView[]>,
  ): Promise<TodoCategoryWithCountView[]> {
    return this.cacheService.wrap(
      TodoCategoryCacheKey.list(userId),
      factory,
      TODO_CATEGORY_CACHE_TTL_MS,
    );
  }

  invalidate(userId: string): Promise<void> {
    return this.cacheService.del(TodoCategoryCacheKey.list(userId));
  }
}
