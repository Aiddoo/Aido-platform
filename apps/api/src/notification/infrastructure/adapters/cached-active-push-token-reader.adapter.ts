import { Inject, Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import { type ActivePushTokenReaderPort } from "../../application/ports/active-push-token.reader.port";
import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../../application/ports/push-token.repository.port";
import {
	NOTIFICATION_CACHE_TTL_MS,
	NotificationCacheKey,
} from "../cache/notification-cache.keyspace";

@Injectable()
export class CachedActivePushTokenReaderAdapter implements ActivePushTokenReaderPort {
	constructor(
		@Inject(PUSH_TOKEN_REPOSITORY)
		private readonly pushTokenRepository: PushTokenRepositoryPort,
		private readonly cacheService: CacheService,
	) {}

	findByUserId(userId: string): Promise<readonly string[]> {
		return this.cacheService.wrapPushTokens(userId, async () => {
			const records = await this.pushTokenRepository.findPushTokensByUser({
				userId,
				activeOnly: true,
			});
			return records.map((record) => record.token);
		});
	}

	async findByUserIds(userIds: readonly string[]): Promise<ReadonlyMap<string, readonly string[]>> {
		if (userIds.length === 0) return new Map();

		const tokensByUserId = new Map<string, readonly string[]>();
		const cacheKeys = userIds.map((userId) => NotificationCacheKey.pushTokens(userId));
		const cachedTokens = await this.cacheService.mget<string[]>(cacheKeys);
		const missedUserIds: string[] = [];

		for (const [index, userId] of userIds.entries()) {
			const tokens = cachedTokens[index];
			if (tokens === undefined) {
				missedUserIds.push(userId);
			} else if (tokens.length > 0) {
				tokensByUserId.set(userId, tokens);
			}
		}

		if (missedUserIds.length === 0) return tokensByUserId;

		const records = await this.pushTokenRepository.findActivePushTokensByUsers(missedUserIds);
		const loadedTokensByUserId = new Map<string, string[]>();
		for (const record of records) {
			const tokens = loadedTokensByUserId.get(record.userId) ?? [];
			tokens.push(record.token);
			loadedTokensByUserId.set(record.userId, tokens);
		}

		await this.cacheService.mset(
			missedUserIds.map((userId) => ({
				key: NotificationCacheKey.pushTokens(userId),
				value: loadedTokensByUserId.get(userId) ?? [],
				ttl: NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS,
			})),
		);

		for (const [userId, tokens] of loadedTokensByUserId) {
			tokensByUserId.set(userId, tokens);
		}
		return tokensByUserId;
	}
}
