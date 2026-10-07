import { Injectable } from "@nestjs/common";

import {
  FollowCacheKey,
  FOLLOW_CACHE_TTL_MS,
} from "#api/modules/social/infrastructure/cache/friends/follow-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";

import type { FollowCachePort } from "../../../application/ports/friends/follow-cache.port.js";

@Injectable()
export class FollowCacheAdapter implements FollowCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getMutualFriend(smallerId: string, largerId: string): Promise<boolean | undefined> {
    return this.cacheService.get(FollowCacheKey.mutual(smallerId, largerId));
  }

  setMutualFriend(smallerId: string, largerId: string, isMutual: boolean): Promise<void> {
    return this.cacheService.set(
      FollowCacheKey.mutual(smallerId, largerId),
      isMutual,
      FOLLOW_CACHE_TTL_MS.MUTUAL,
    );
  }

  invalidateMutualFriend(userId: string, targetUserId: string): Promise<void> {
    const [smallerId, largerId] =
      userId < targetUserId ? [userId, targetUserId] : [targetUserId, userId];
    return this.cacheService.del(FollowCacheKey.mutual(smallerId, largerId));
  }

  wrapMutualFriendIds(userId: string, factory: () => Promise<string[]>): Promise<string[]> {
    return this.cacheService.wrap(FollowCacheKey.ids(userId), factory, FOLLOW_CACHE_TTL_MS.IDS);
  }

  invalidateMutualFriendIds(userId: string): Promise<void> {
    return this.cacheService.del(FollowCacheKey.ids(userId));
  }

  wrapFriendCount(userId: string, factory: () => Promise<number>): Promise<number> {
    return this.cacheService.wrap(FollowCacheKey.count(userId), factory, FOLLOW_CACHE_TTL_MS.COUNT);
  }

  invalidateFriendCount(userId: string): Promise<void> {
    return this.cacheService.del(FollowCacheKey.count(userId));
  }
}
