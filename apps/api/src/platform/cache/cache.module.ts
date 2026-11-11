import { type DynamicModule, Global, Module, type Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import type { Redis } from "ioredis";

import { cacheConfig, selectSharedRedis } from "../config/cache.config.js";
import { REDIS_COMMAND_CLIENT } from "../redis/redis.constants.js";
import { InMemoryCacheStore } from "./adapters/in-memory-cache.store.js";
import { RedisCacheStore } from "./adapters/redis-cache.store.js";
import { CacheStorePort } from "./cache-store.port.js";

/** `CACHE_TYPE=redis`이고 Redis 연결이 있으면 Redis·Valkey, 아니면 프로세스 안 lru-cache를 쓴다. */
@Global()
@Module({})
export class CacheModule {
  static forRoot(): DynamicModule {
    const storeProvider: Provider = {
      provide: CacheStorePort,
      useFactory: (cache: ConfigType<typeof cacheConfig>, redis?: Redis | null): CacheStorePort => {
        const shared = selectSharedRedis(cache, redis);
        return shared == null
          ? new InMemoryCacheStore({ defaultTtlMs: cache.defaultTtlMs, maxItems: cache.maxItems })
          : new RedisCacheStore(shared, cache.defaultTtlMs);
      },
      inject: [cacheConfig.KEY, { token: REDIS_COMMAND_CLIENT, optional: true }],
    };

    return {
      module: CacheModule,
      providers: [storeProvider],
      exports: [CacheStorePort],
    };
  }

  static forTesting(store: CacheStorePort): DynamicModule {
    return {
      module: CacheModule,
      providers: [{ provide: CacheStorePort, useValue: store }],
      exports: [CacheStorePort],
    };
  }
}
