import { cacheKey } from "#api/platform/cache/keyspace/cache-key";

export const TODO_CATEGORY_CACHE_TTL_MS = 5 * 60_000;
export const TodoCategoryCacheKey = {
  list: (userId: string) => cacheKey("todo-category", "list", userId),
} as const;
