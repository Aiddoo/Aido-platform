import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendshipCachePort } from "../../application/ports/friendship-cache.port.js";
import { FriendshipCacheKey, FRIENDSHIP_CACHE_TTL_MS } from "../cache/friendship-cache.keyspace.js";

@Injectable()
export class FriendshipCacheAdapter implements FriendshipCachePort {
  readonly #cacheStore: CacheStorePort;

  constructor(cacheStore: CacheStorePort) {
    this.#cacheStore = cacheStore;
  }

  getMutualFriend(smallerId: UserId, largerId: UserId): Promise<boolean | undefined> {
    return this.#cacheStore.get(
      FriendshipCacheKey.mutual(smallerId.value, largerId.value),
      z.boolean(),
    );
  }

  setMutualFriend(smallerId: UserId, largerId: UserId, isMutual: boolean): Promise<void> {
    return this.#cacheStore.set(
      FriendshipCacheKey.mutual(smallerId.value, largerId.value),
      isMutual,
      FRIENDSHIP_CACHE_TTL_MS.MUTUAL,
    );
  }

  invalidateMutualFriend(userId: UserId, targetUserId: UserId): Promise<void> {
    const [smallerId, largerId] =
      userId.value < targetUserId.value
        ? [userId.value, targetUserId.value]
        : [targetUserId.value, userId.value];
    return this.#cacheStore.del(FriendshipCacheKey.mutual(smallerId, largerId));
  }

  wrapMutualFriendIds(userId: UserId, factory: () => Promise<string[]>): Promise<string[]> {
    return this.#cacheStore.wrap(
      FriendshipCacheKey.ids(userId.value),
      z.array(z.string()),
      factory,
      FRIENDSHIP_CACHE_TTL_MS.IDS,
    );
  }

  invalidateMutualFriendIds(userId: UserId): Promise<void> {
    return this.#cacheStore.del(FriendshipCacheKey.ids(userId.value));
  }

  wrapFriendCount(userId: UserId, factory: () => Promise<number>): Promise<number> {
    return this.#cacheStore.wrap(
      FriendshipCacheKey.count(userId.value),
      z.number(),
      factory,
      FRIENDSHIP_CACHE_TTL_MS.COUNT,
    );
  }

  invalidateFriendCount(userId: UserId): Promise<void> {
    return this.#cacheStore.del(FriendshipCacheKey.count(userId.value));
  }
}
