import { type DynamicModule, Global, Module, type Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { Redis } from "ioredis";

import { cacheConfig, selectSharedRedis } from "../config/cache.config.js";
import { REDIS_COMMAND_CLIENT } from "../redis/redis.constants.js";
import { InMemoryDedupAdapter } from "./adapters/in-memory-dedup.adapter.js";
import { RedisDedupAdapter } from "./adapters/redis-dedup.adapter.js";
import { DedupProviderPort } from "./dedup-provider.port.js";

/**
 * 중복 방지 모듈
 *
 * 환경변수 기반으로 인메모리/Redis 어댑터 선택
 *
 * @example
 * // app.module.ts
 * imports: [DedupModule.forRoot()]
 *
 * @example
 * // 테스트에서
 * imports: [DedupModule.forTesting(mockAdapter)]
 */
@Global()
@Module({})
export class DedupModule {
  /**
   * 프로덕션용 모듈 설정
   *
   * 환경변수:
   * - CACHE_TYPE: 'memory' | 'redis' (기본값: 'memory')
   *   캐시와 동일한 환경변수를 사용하여 인프라 일관성 유지
   */
  static forRoot(): DynamicModule {
    const dedupProvider: Provider = {
      provide: DedupProviderPort,
      useFactory: (cache: ConfigType<typeof cacheConfig>, redis?: Redis): DedupProviderPort => {
        const shared = selectSharedRedis(cache, redis);
        return shared == null ? new InMemoryDedupAdapter() : new RedisDedupAdapter(shared);
      },
      inject: [cacheConfig.KEY, { token: REDIS_COMMAND_CLIENT, optional: true }],
    };

    return {
      module: DedupModule,
      providers: [dedupProvider],
      exports: [DedupProviderPort],
    };
  }

  /**
   * 테스트용 모듈 설정
   *
   * 특정 어댑터를 직접 주입하여 사용
   *
   * @example
   * const adapter = new InMemoryDedupAdapter();
   * const module = await Test.createTestingModule({
   *   imports: [DedupModule.forTesting(adapter)],
   * }).compile();
   */
  static forTesting(adapter: DedupProviderPort): DynamicModule {
    return {
      module: DedupModule,
      providers: [{ provide: DedupProviderPort, useValue: adapter }],
      exports: [DedupProviderPort],
    };
  }
}
