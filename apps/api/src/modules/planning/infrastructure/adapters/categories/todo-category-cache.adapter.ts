import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  TodoCategoryCacheKey,
  TODO_CATEGORY_CACHE_TTL_MS,
} from "#api/modules/planning/infrastructure/cache/categories/todo-category-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";

import type { TodoCategoryCachePort } from "../../../application/ports/categories/todo-category-cache.port.js";
import type { TodoCategoryWithCountView } from "../../../application/ports/categories/todo-category.repository.port.js";

/** Redis JSON에서 문자열이 된 생성·수정 시각을 Date로 복원한다. */
const TODO_CATEGORY_LIST_SCHEMA = z.array(
  z.object({
    id: z.number(),
    userId: z.string(),
    name: z.string(),
    color: z.string(),
    sortOrder: z.number(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    todoCount: z.number(),
  }),
) satisfies z.ZodType<TodoCategoryWithCountView[]>;

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
      TODO_CATEGORY_LIST_SCHEMA,
      factory,
      TODO_CATEGORY_CACHE_TTL_MS,
    );
  }

  invalidate(userId: string): Promise<void> {
    return this.cacheService.del(TodoCategoryCacheKey.list(userId));
  }
}
