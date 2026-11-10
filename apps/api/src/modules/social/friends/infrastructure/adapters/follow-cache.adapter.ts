import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  FollowCacheKey,
  FOLLOW_CACHE_TTL_MS,
} from "#api/modules/social/friends/infrastructure/cache/follow-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FollowCachePort } from "../../application/ports/follow-cache.port.js";

@Injectable()
export class FollowCacheAdapter implements FollowCachePort {
  readonly #cacheService: CacheService;

  constructor(cacheService: CacheService) {
    this.#cacheService = cacheService;
  }

  getMutualFriend(smallerId: UserId, largerId: UserId): Promise<boolean | undefined> {
    return this.#cacheService.get(
      FollowCacheKey.mutual(smallerId.value, largerId.value),
      z.boolean(),
    );
  }

  setMutualFriend(smallerId: UserId, largerId: UserId, isMutual: boolean): Promise<void> {
    return this.#cacheService.set(
      FollowCacheKey.mutual(smallerId.value, largerId.value),
      isMutual,
      FOLLOW_CACHE_TTL_MS.MUTUAL,
    );
  }

  invalidateMutualFriend(userId: UserId, targetUserId: UserId): Promise<void> {
    const [smallerId, largerId] =
      userId.value < targetUserId.value
        ? [userId.value, targetUserId.value]
        : [targetUserId.value, userId.value];
    return this.#cacheService.del(FollowCacheKey.mutual(smallerId, largerId));
  }

  wrapMutualFriendIds(userId: UserId, factory: () => Promise<string[]>): Promise<string[]> {
    return this.#cacheService.wrap(
      FollowCacheKey.ids(userId.value),
      z.array(z.string()),
      factory,
      FOLLOW_CACHE_TTL_MS.IDS,
    );
  }

  invalidateMutualFriendIds(userId: UserId): Promise<void> {
    return this.#cacheService.del(FollowCacheKey.ids(userId.value));
  }

  wrapFriendCount(userId: UserId, factory: () => Promise<number>): Promise<number> {
    return this.#cacheService.wrap(
      FollowCacheKey.count(userId.value),
      z.number(),
      factory,
      FOLLOW_CACHE_TTL_MS.COUNT,
    );
  }

  invalidateFriendCount(userId: UserId): Promise<void> {
    return this.#cacheService.del(FollowCacheKey.count(userId.value));
  }
}
