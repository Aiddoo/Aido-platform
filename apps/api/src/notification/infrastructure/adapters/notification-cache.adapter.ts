import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/shared/infrastructure/cache/cache.service";

import type { NotificationCachePort } from "../../application/ports/notification-cache.port.js";
import type { NotificationInboxScope } from "../../domain/services/notification-client-capability.js";
import {
	NotificationCacheKey,
	NOTIFICATION_CACHE_TTL_MS,
} from "../cache/notification-cache.keyspace.js";

/** 알림 컨텍스트의 키·TTL을 사용해 공유 캐시를 연결한다. */
@Injectable()
export class NotificationCacheAdapter implements NotificationCachePort {
	constructor(private readonly cacheService: CacheService) {}

	wrapUnreadCount(
		userId: string,
		factory: () => Promise<number>,
		scope: NotificationInboxScope = "all",
	): Promise<number> {
		return this.cacheService.wrap(
			NotificationCacheKey.unreadCount(userId, scope),
			factory,
			NOTIFICATION_CACHE_TTL_MS.UNREAD_COUNT,
		);
	}

	async invalidateUnreadCount(userId: string): Promise<void> {
		await Promise.all([
			this.cacheService.del(NotificationCacheKey.unreadCount(userId)),
			this.cacheService.del(NotificationCacheKey.unreadCount(userId, "legacy")),
		]);
	}

	invalidatePushTokens(userId: string): Promise<void> {
		return this.cacheService.invalidatePushTokens(userId);
	}

	invalidateUserPreference(userId: string): Promise<void> {
		return this.cacheService.invalidateUserPreference(userId);
	}
}
