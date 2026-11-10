import { type DynamicModule, Global, Module, type Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { Redis } from "ioredis";

import { cacheConfig } from "../config/cache.config.js";
import { REDIS_COMMAND_CLIENT } from "../redis/redis.constants.js";
import { InMemoryCacheAdapter } from "./adapters/in-memory-cache.adapter.js";
import { RedisCacheAdapter } from "./adapters/redis-cache.adapter.js";
import { CacheService } from "./cache.service.js";
import { CACHE_SERVICE, type ICacheService } from "./interfaces/cache.interface.js";

/**
 * 캐시 모듈
 *
 * 환경변수 기반으로 인메모리/Redis 어댑터 선택
 *
 * @example
 * // app.module.ts
 * imports: [CacheModule.forRoot()]
 *
 * @example
 * // 테스트에서
 * imports: [CacheModule.forTesting(mockAdapter)]
 */
@Global()
@Module({})
export class CacheModule {
  /**
   * 프로덕션용 모듈 설정
   *
   * 환경변수:
   * - CACHE_TYPE: 'memory' | 'redis' (기본값: 'memory')
   * - CACHE_DEFAULT_TTL_MS: 기본 TTL (기본값: 60000)
   * - CACHE_MAX_ITEMS: 최대 항목 수 (기본값: 1000, 인메모리 전용)
   * - CACHE_CLEANUP_INTERVAL_MS: 만료된 항목 정리 주기 (기본값: 30000, 최소: 1000)
   */
  static forRoot(): DynamicModule {
    const cacheProvider: Provider = {
      provide: CACHE_SERVICE,
      useFactory: (cache: ConfigType<typeof cacheConfig>, redis?: Redis): ICacheService => {
        if (cache.type === "redis" && redis) {
          return new RedisCacheAdapter(redis, cache.defaultTtlMs);
        }

        return new InMemoryCacheAdapter({
          defaultTtlMs: cache.defaultTtlMs,
          maxItems: cache.maxItems,
          cleanupIntervalMs: cache.cleanupIntervalMs,
        });
      },
      inject: [cacheConfig.KEY, { token: REDIS_COMMAND_CLIENT, optional: true }],
    };

    return {
      module: CacheModule,
      providers: [cacheProvider, CacheService],
      exports: [CACHE_SERVICE, CacheService],
    };
  }

  /**
   * 테스트용 모듈 설정
   *
   * 특정 어댑터를 직접 주입하여 사용
   *
   * @example
   * const mockAdapter = createMockCacheService();
   * const module = await Test.createTestingModule({
   *   imports: [CacheModule.forTesting(mockAdapter)],
   * }).compile();
   */
  static forTesting(adapter: ICacheService): DynamicModule {
    return {
      module: CacheModule,
      providers: [{ provide: CACHE_SERVICE, useValue: adapter }, CacheService],
      exports: [CACHE_SERVICE, CacheService],
    };
  }
}
