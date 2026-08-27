import { cacheKey, cachePattern } from "@/shared/infrastructure/cache/keyspace/cache-key";

export const TODO_CACHE_TTL_MS = {
	FRIEND_VIEW: 60_000,
	// 페이지보다 충분히 길어 generation 만료 뒤 이전 페이지가 되살아나지 않게 한다.
	FRIEND_VIEW_GENERATION: 86_400_000,
} as const;

export const FRIEND_TODOS_INITIAL_GENERATION = "initial";

export const TodoCacheKey = {
	// v2 배포 전 Redis 키 계약. 새 reader는 읽지 않고 invalidate/TTL로만 정리한다.
	friendTodosFirstPage: (ownerUserId: string, startDate: string, endDate: string, size: number) =>
		cacheKey("todo", "friend-view-v1", ownerUserId, startDate, endDate, String(size)),
	friendTodosPattern: (ownerUserId: string) => cachePattern("todo", "friend-view-v1", ownerUserId),
	friendTodosGeneration: (ownerUserId: string) =>
		cacheKey("todo", "friend-view-v2-generation", ownerUserId),
	friendTodosFirstPageVersioned: (
		ownerUserId: string,
		generation: string,
		startDate: string,
		endDate: string,
		size: number,
	) =>
		cacheKey("todo", "friend-view-v2", ownerUserId, generation, startDate, endDate, String(size)),
	friendTodosGenerationPattern: (ownerUserId: string, generation: string) =>
		cachePattern("todo", "friend-view-v2", ownerUserId, generation),
} as const;
