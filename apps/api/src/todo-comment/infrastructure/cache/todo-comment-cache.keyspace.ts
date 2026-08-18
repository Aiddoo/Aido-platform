import { TODO_COMMENT_LIMITS, type TodoCommentSort } from "@aido/validators";

import { cacheKey, cachePattern } from "@/shared/infrastructure/cache/keyspace/cache-key";

export const TODO_COMMENT_CACHE_TTL_MS = {
	POPULAR_FIRST_PAGE: 10_000,
	LATEST_FIRST_PAGE: 30_000,
	GENERATION: 86_400_000,
} as const;

export const TODO_COMMENT_INITIAL_GENERATION = "initial";

export const TodoCommentCacheKey = {
	topLevelFirstPage(todoId: number, sort: TodoCommentSort, generation: string) {
		return cacheKey(
			"todo-comments",
			"top-level-first-page-v4",
			String(todoId),
			generation,
			sort.toLowerCase(),
			String(TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE),
		);
	},
	generation: (todoId: number) => cacheKey("todo-comments", "generation-v1", String(todoId)),
	firstPageGenerationPattern: (todoId: number, generation: string) =>
		cachePattern("todo-comments", "top-level-first-page-v4", String(todoId), generation),
	legacyFirstPagePattern: (todoId: number) =>
		cachePattern("todo-comments", "top-level-first-page-v3", String(todoId)),
} as const;
