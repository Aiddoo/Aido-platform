import {
	cacheKey,
	cachePattern,
} from "@/shared/infrastructure/cache/keyspace/cache-key";

export const TODO_CACHE_TTL_MS = { FRIEND_VIEW: 60_000 } as const;

export const TodoCacheKey = {
	friendTodosFirstPage: (
		ownerUserId: string,
		startDate: string,
		endDate: string,
		size: number,
	) =>
		cacheKey(
			"todo",
			"friend-view-v1",
			ownerUserId,
			startDate,
			endDate,
			String(size),
		),
	friendTodosPattern: (ownerUserId: string) =>
		cachePattern("todo", "friend-view-v1", ownerUserId),
} as const;
