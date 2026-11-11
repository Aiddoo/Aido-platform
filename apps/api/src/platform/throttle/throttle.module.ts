import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { Redis } from "ioredis";

import { cacheConfig, selectSharedRedis } from "../config/cache.config.js";
import { REDIS_COMMAND_CLIENT } from "../redis/redis.constants.js";
import { RedisThrottlerStorage } from "./redis-throttler-storage.js";
import { THROTTLER_STORAGE } from "./throttle.constants.js";

/**
 * 스로틀 스토리지 모듈
 *
 * cache/lock/dedup 모듈과 동일한 포트/어댑터 조립 형태:
 * CACHE_TYPE=redis + Redis 연결이 있으면 RedisThrottlerStorage,
 * 아니면 undefined(@nestjs/throttler 기본 in-memory storage 사용).
 *
 * @example
 * // app.module.ts
 * ThrottlerModule.forRootAsync({
 *   imports: [ThrottleModule.forRoot()],
 *   inject: [ConfigService, { token: THROTTLER_STORAGE, optional: true }],
 *   ...
 * })
 */
@Module({})
export class ThrottleModule {
  static forRoot(): DynamicModule {
    const storageProvider: Provider = {
      provide: THROTTLER_STORAGE,
      useFactory: (
        cache: ConfigType<typeof cacheConfig>,
        redis?: Redis,
      ): ThrottlerStorage | undefined => {
        const shared = selectSharedRedis(cache, redis);
        return shared == null ? undefined : new RedisThrottlerStorage(shared);
      },
      inject: [cacheConfig.KEY, { token: REDIS_COMMAND_CLIENT, optional: true }],
    };

    return {
      module: ThrottleModule,
      providers: [storageProvider],
      exports: [THROTTLER_STORAGE],
    };
  }

  /**
   * 테스트용 모듈 설정
   */
  static forTesting(storage?: ThrottlerStorage): DynamicModule {
    return {
      module: ThrottleModule,
      providers: [{ provide: THROTTLER_STORAGE, useValue: storage }],
      exports: [THROTTLER_STORAGE],
    };
  }
}
