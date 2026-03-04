import {
	type DynamicModule,
	Global,
	Module,
	type Provider,
} from "@nestjs/common";
import type Redis from "ioredis";
import { TypedConfigService } from "../config/services/config.service";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { InMemoryCacheAdapter } from "./adapters/in-memory-cache.adapter";
import { RedisCacheAdapter } from "./adapters/redis-cache.adapter";
import { CacheService } from "./cache.service";
import {
	CACHE_SERVICE,
	type ICacheService,
} from "./interfaces/cache.interface";

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
			useFactory: (
				configService: TypedConfigService,
				redis?: Redis,
			): ICacheService => {
				const cacheConfig = configService.cache;

				if (cacheConfig.type === "redis" && redis) {
					return new RedisCacheAdapter(redis, cacheConfig.defaultTtlMs);
				}

				return new InMemoryCacheAdapter({
					defaultTtlMs: cacheConfig.defaultTtlMs,
					maxItems: cacheConfig.maxItems,
					cleanupIntervalMs: cacheConfig.cleanupIntervalMs,
				});
			},
			inject: [TypedConfigService, { token: REDIS_CLIENT, optional: true }],
		};

		return {
			module: CacheModule,
			providers: [TypedConfigService, cacheProvider, CacheService],
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
