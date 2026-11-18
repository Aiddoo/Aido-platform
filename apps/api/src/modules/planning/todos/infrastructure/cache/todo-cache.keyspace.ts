import { cacheKey } from "#api/platform/cache/keyspace/cache-key";
import { DAY_MS } from "#api/shared/domain/time/time-units";

export const TODO_CACHE_TTL_MS = {
  FRIEND_VIEW: 60_000,
  // 페이지보다 충분히 길어 generation 만료 뒤 이전 페이지가 되살아나지 않게 한다.
  FRIEND_VIEW_GENERATION: DAY_MS,
} as const;

export const FRIEND_TODOS_INITIAL_GENERATION = "initial";

interface FriendTodosFirstPageKey {
  readonly ownerUserId: string;
  readonly generation: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly size: number;
}

export const TodoCacheKey = {
  friendTodosGeneration: (ownerUserId: string) =>
    cacheKey("todo", "friend-view-v2-generation", ownerUserId),
  friendTodosFirstPageVersioned: (page: FriendTodosFirstPageKey) =>
    cacheKey(
      "todo",
      "friend-view-v2",
      page.ownerUserId,
      page.generation,
      page.startDate,
      page.endDate,
      String(page.size),
    ),
} as const;
