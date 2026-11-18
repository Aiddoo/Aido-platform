import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { GenerationGuardedCache } from "#api/platform/cache/generation-guarded-cache";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendshipCachePort } from "../../application/ports/friendship-cache.port.js";
import { FriendshipCacheKey, FRIENDSHIP_CACHE_TTL_MS } from "../cache/friendship-cache.keyspace.js";

function idsKey(userId: UserId) {
  return {
    valueKey: FriendshipCacheKey.ids(userId.value),
    generationKey: FriendshipCacheKey.idsGeneration(userId.value),
  };
}

function countKey(userId: UserId) {
  return {
    valueKey: FriendshipCacheKey.count(userId.value),
    generationKey: FriendshipCacheKey.countGeneration(userId.value),
  };
}

// 친구 id 목록·수는 친구 관계 쓰기의 커밋 전에 읽은 값이 무효화 뒤 다시 저장되지 않도록 세대를 확인한다
@Injectable()
export class FriendshipCacheAdapter implements FriendshipCachePort {
  readonly #cacheStore: CacheStorePort;
  readonly #friendIds: GenerationGuardedCache;
  readonly #friendCounts: GenerationGuardedCache;

  constructor(cacheStore: CacheStorePort) {
    this.#cacheStore = cacheStore;
    this.#friendIds = new GenerationGuardedCache(cacheStore, FRIENDSHIP_CACHE_TTL_MS.IDS);
    this.#friendCounts = new GenerationGuardedCache(cacheStore, FRIENDSHIP_CACHE_TTL_MS.COUNT);
  }

  async findMutualFriend(smallerId: UserId, largerId: UserId): Promise<boolean | null> {
    const cached = await this.#cacheStore.get(
      FriendshipCacheKey.mutual(smallerId.value, largerId.value),
      z.boolean(),
    );
    return cached ?? null;
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
    return this.#friendIds.wrap({
      key: idsKey(userId),
      schema: z.array(z.string()),
      factory,
      ttlMs: FRIENDSHIP_CACHE_TTL_MS.IDS,
    });
  }

  invalidateMutualFriendIds(userId: UserId): Promise<void> {
    return this.#friendIds.invalidate(idsKey(userId));
  }

  wrapFriendCount(userId: UserId, factory: () => Promise<number>): Promise<number> {
    return this.#friendCounts.wrap({
      key: countKey(userId),
      schema: z.number(),
      factory,
      ttlMs: FRIENDSHIP_CACHE_TTL_MS.COUNT,
    });
  }

  invalidateFriendCount(userId: UserId): Promise<void> {
    return this.#friendCounts.invalidate(countKey(userId));
  }
}
