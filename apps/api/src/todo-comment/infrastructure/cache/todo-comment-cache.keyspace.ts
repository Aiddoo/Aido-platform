import { TODO_COMMENT_LIMITS, type TodoCommentSort } from "@aido/validators";

import { cacheKey } from "@/shared/infrastructure/cache/keyspace/cache-key";

export const TODO_COMMENT_CACHE_TTL_MS = {
	POPULAR_FIRST_PAGE: 10_000,
	LATEST_FIRST_PAGE: 30_000,
} as const;

export const TodoCommentCacheKey = {
	topLevelFirstPage(todoId: number, sort: TodoCommentSort) {
		return cacheKey(
			"todo-comments",
			"top-level-first-page-v2",
			String(todoId),
			sort.toLowerCase(),
			String(TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE),
		);
	},
} as const;
