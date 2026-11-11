import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  NOTIFICATION_CACHE_TTL_MS,
  NotificationCacheKey,
} from "../../../inbox/infrastructure/cache/notification-cache.keyspace.js";
import type { ActivePushTokenReaderPort } from "../../application/ports/active-push-token.reader.port.js";
import { PushTokenRepositoryPort } from "../../application/ports/push-token.repository.port.js";

const PUSH_TOKENS_SCHEMA = z.array(z.string());

@Injectable()
export class CachedActivePushTokenReaderAdapter implements ActivePushTokenReaderPort {
  readonly #pushTokenRepository: PushTokenRepositoryPort;
  readonly #cacheService: CacheStorePort;

  constructor(pushTokenRepository: PushTokenRepositoryPort, cacheService: CacheStorePort) {
    this.#pushTokenRepository = pushTokenRepository;
    this.#cacheService = cacheService;
  }

  findByUserId(userId: UserId): Promise<readonly string[]> {
    return this.#cacheService.wrap(
      NotificationCacheKey.pushTokens(userId.value),
      PUSH_TOKENS_SCHEMA,
      async () => {
        const records = await this.#pushTokenRepository.findPushTokensByUser({
          userId,
          activeOnly: true,
        });
        return records.map((record) => record.token);
      },
      NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS,
    );
  }

  async findByUserIds(users: readonly UserId[]): Promise<ReadonlyMap<string, readonly string[]>> {
    if (users.length === 0) {
      return new Map();
    }
    const userIds = users.map((user) => user.value);

    const tokensByUserId = new Map<string, readonly string[]>();
    const cacheKeys = userIds.map((userId) => NotificationCacheKey.pushTokens(userId));
    const cachedTokens = await this.#cacheService.mget(cacheKeys, PUSH_TOKENS_SCHEMA);
    const missedUserIds: string[] = [];

    for (const [index, userId] of userIds.entries()) {
      const tokens = cachedTokens[index];
      if (tokens == null) {
        missedUserIds.push(userId);
      } else if (tokens.length > 0) {
        tokensByUserId.set(userId, tokens);
      }
    }

    if (missedUserIds.length === 0) {
      return tokensByUserId;
    }

    const records = await this.#pushTokenRepository.findActivePushTokensByUsers(
      missedUserIds.map((userId) => UserId.reconstitute(userId)),
    );
    const loadedTokensByUserId = new Map<string, string[]>();
    for (const record of records) {
      const tokens = loadedTokensByUserId.get(record.userId) ?? [];
      tokens.push(record.token);
      loadedTokensByUserId.set(record.userId, tokens);
    }

    await this.#cacheService.mset(
      missedUserIds.map((userId) => ({
        key: NotificationCacheKey.pushTokens(userId),
        value: loadedTokensByUserId.get(userId) ?? [],
        ttlMs: NOTIFICATION_CACHE_TTL_MS.PUSH_TOKENS,
      })),
    );

    for (const [userId, tokens] of loadedTokensByUserId) {
      tokensByUserId.set(userId, tokens);
    }
    return tokensByUserId;
  }
}
