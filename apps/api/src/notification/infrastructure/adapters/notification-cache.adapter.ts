import { Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import type { NotificationCachePort } from "../../application/ports/notification-cache.port";

/**
 * NotificationCachePort의 어댑터 — 공유 CacheService(중앙 관리 CacheKeys)에 위임한다.
 * 키 관리·TTL·직렬화는 CacheService/CacheKeys가 소유하고, 이 어댑터는 알림 캐시
 * 시맨틱만 노출한다.
 */
@Injectable()
export class NotificationCacheAdapter implements NotificationCachePort {
	constructor(private readonly cacheService: CacheService) {}

	wrapUnreadCount(userId: string, factory: () => Promise<number>): Promise<number> {
		return this.cacheService.wrapUnreadCount(userId, factory);
	}

	invalidateUnreadCount(userId: string): Promise<void> {
		return this.cacheService.invalidateUnreadCount(userId);
	}

	invalidatePushTokens(userId: string): Promise<void> {
		return this.cacheService.invalidatePushTokens(userId);
	}

	invalidateUserPreference(userId: string): Promise<void> {
		return this.cacheService.invalidateUserPreference(userId);
	}
}
