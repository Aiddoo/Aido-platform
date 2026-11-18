import { Injectable } from "@nestjs/common";
import { groupBy } from "es-toolkit";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { GenerationGuardedCache } from "#api/platform/cache/generation-guarded-cache";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { PUSH_CHANNELS } from "../../../shared/domain/push-channel.constants.js";
import { toActivePushTokens } from "../../application/active-push-token.mapper.js";
import type { ActivePushTokenReaderPort } from "../../application/ports/active-push-token.reader.port.js";
import { PushTokenRepositoryPort } from "../../application/ports/push-token.repository.port.js";
import type { ActivePushTokenReadModel } from "../../application/read-models/active-push-token.read-model.js";
import {
  PUSH_TOKEN_CACHE_TTL_MS,
  PushTokenCacheKey,
  pushTokensCacheKey,
} from "../cache/push-token-cache.keyspace.js";

// 토큰 문자열 배열로 저장한 이전 값은 스키마가 달라 미스가 되고 DB에서 다시 읽는다
const PUSH_TOKENS_SCHEMA = z.array(
  z.object({
    token: z.string(),
    channel: z.enum(PUSH_CHANNELS),
    appVersion: z.string().nullable(),
  }),
);

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

  findByUserId(userId: UserId): Promise<readonly ActivePushTokenReadModel[]> {
    return this.#pushTokens.wrap({
      key: pushTokensCacheKey(userId.value),
      schema: PUSH_TOKENS_SCHEMA,
      factory: async () => {
        const records = await this.#pushTokenRepository.findPushTokensByUser({
          userId,
          activeOnly: true,
        });
        return toActivePushTokens(records);
      },
      ttlMs: PUSH_TOKEN_CACHE_TTL_MS.PUSH_TOKENS,
    });
  }

  // 아침·저녁 묶음 발송은 수신자마다 키를 새로 쓰면 공용 LRU의 세션·권한 키를 밀어내므로 읽기만 한다
  async findByUserIds(
    users: readonly UserId[],
  ): Promise<ReadonlyMap<string, readonly ActivePushTokenReadModel[]>> {
    if (users.length === 0) {
      return new Map();
    }
    const userIds = users.map((user) => user.value);
    const cachedTokens = await this.#cacheService.mget(
      userIds.map((userId) => PushTokenCacheKey.pushTokens(userId)),
      PUSH_TOKENS_SCHEMA,
    );

    const tokensByUserId = new Map<string, readonly ActivePushTokenReadModel[]>();
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
      const tokens = toActivePushTokens(userRecords);
      if (tokens.length > 0) {
        tokensByUserId.set(userId, tokens);
      }
    }
    return tokensByUserId;
  }
}
