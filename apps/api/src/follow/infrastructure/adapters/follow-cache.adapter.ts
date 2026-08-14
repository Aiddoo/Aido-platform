import { Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import type { FollowCachePort } from "../../application/ports/follow-cache.port";

/**
 * FollowCachePort의 어댑터 — 공유 CacheService(중앙 관리 CacheKeys)에 위임한다.
 * 키 관리·TTL·직렬화는 CacheService/CacheKeys가 소유하고, 이 어댑터는 친구 관계
 * 시맨틱만 노출한다.
 */
@Injectable()
export class FollowCacheAdapter implements FollowCachePort {
	constructor(private readonly cacheService: CacheService) {}

	getMutualFriend(smallerId: string, largerId: string): Promise<boolean | undefined> {
		return this.cacheService.getMutualFriend(smallerId, largerId);
	}

	setMutualFriend(smallerId: string, largerId: string, isMutual: boolean): Promise<void> {
		return this.cacheService.setMutualFriend(smallerId, largerId, isMutual);
	}

	invalidateMutualFriend(userId: string, targetUserId: string): Promise<void> {
		return this.cacheService.invalidateMutualFriend(userId, targetUserId);
	}

	wrapMutualFriendIds(userId: string, factory: () => Promise<string[]>): Promise<string[]> {
		return this.cacheService.wrapMutualFriendIds(userId, factory);
	}

	invalidateMutualFriendIds(userId: string): Promise<void> {
		return this.cacheService.invalidateMutualFriendIds(userId);
	}

	wrapFriendCount(userId: string, factory: () => Promise<number>): Promise<number> {
		return this.cacheService.wrapFriendCount(userId, factory);
	}

	invalidateFriendCount(userId: string): Promise<void> {
		return this.cacheService.invalidateFriendCount(userId);
	}
}
