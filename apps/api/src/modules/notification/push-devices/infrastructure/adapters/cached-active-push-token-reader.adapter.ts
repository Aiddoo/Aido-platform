import { Injectable } from "@nestjs/common";
import { groupBy } from "es-toolkit";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { GenerationGuardedCache } from "#api/platform/cache/generation-guarded-cache";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ActivePushTokenReaderPort } from "../../application/ports/active-push-token.reader.port.js";
import { PushTokenRepositoryPort } from "../../application/ports/push-token.repository.port.js";
import {
  PUSH_TOKEN_CACHE_TTL_MS,
  PushTokenCacheKey,
  pushTokensCacheKey,
} from "../cache/push-token-cache.keyspace.js";

const PUSH_TOKENS_SCHEMA = z.array(z.string());

@Injectable()
export class CachedActivePushTokenReaderAdapter implements ActivePushTokenReaderPort {
  readonly #pushTokenRepository: PushTokenRepositoryPort;
  readonly #cacheService: CacheStorePort;
  readonly #pushTokens: GenerationGuardedCache;

  constructor(pushTokenRepository: PushTokenRepositoryPort, cacheService: CacheStorePort) {
    this.#pushTokenRepository = pushTokenRepository;
    this.#cacheService = cacheService;
    this.#pushTokens = new GenerationGuardedCache(
      cacheService,
      PUSH_TOKEN_CACHE_TTL_MS.PUSH_TOKENS,
    );
  }

  findByUserId(userId: UserId): Promise<readonly string[]> {
    return this.#pushTokens.wrap({
      key: pushTokensCacheKey(userId.value),
      schema: PUSH_TOKENS_SCHEMA,
      factory: async () => {
        const records = await this.#pushTokenRepository.findPushTokensByUser({
          userId,
          activeOnly: true,
        });
        return records.map((record) => record.token);
      },
      ttlMs: PUSH_TOKEN_CACHE_TTL_MS.PUSH_TOKENS,
    });
  }

  // 아침·저녁 묶음 발송은 수신자마다 키를 새로 쓰면 공용 LRU의 세션·권한 키를 밀어내므로 읽기만 한다
  async findByUserIds(users: readonly UserId[]): Promise<ReadonlyMap<string, readonly string[]>> {
    if (users.length === 0) {
      return new Map();
    }
    const userIds = users.map((user) => user.value);
    const cachedTokens = await this.#cacheService.mget(
      userIds.map((userId) => PushTokenCacheKey.pushTokens(userId)),
      PUSH_TOKENS_SCHEMA,
    );

    const tokensByUserId = new Map<string, readonly string[]>();
    const missedUsers: UserId[] = [];
    for (const [index, user] of users.entries()) {
      const tokens = cachedTokens[index];
      if (tokens == null) {
        missedUsers.push(user);
      } else if (tokens.length > 0) {
        tokensByUserId.set(user.value, tokens);
      }
    }
    if (missedUsers.length === 0) {
      return tokensByUserId;
    }

    const records = await this.#pushTokenRepository.findActivePushTokensByUsers(missedUsers);
    for (const [userId, userRecords] of Object.entries(
      groupBy(records, (record) => record.userId),
    )) {
      tokensByUserId.set(
        userId,
        userRecords.map((record) => record.token),
      );
    }
    return tokensByUserId;
  }
}
