import {
	type DynamicModule,
	Global,
	Module,
	type Provider,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InMemoryCacheAdapter } from "./adapters/in-memory-cache.adapter";
import { RedisCacheAdapter } from "./adapters/redis-cache.adapter";
import { CacheService } from "./cache.service";
import {
	CACHE_SERVICE,
	type CacheConfig,
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
	 * - REDIS_HOST: Redis 호스트 (redis 사용 시 필수)
	 * - REDIS_PORT: Redis 포트 (기본값: 6379)
	 * - REDIS_PASSWORD: Redis 비밀번호 (선택)
	 * - REDIS_DB: Redis DB 번호 (기본값: 0)
	 */
	static forRoot(): DynamicModule {
		const cacheProvider: Provider = {
			provide: CACHE_SERVICE,
			useFactory: (configService: ConfigService): ICacheService => {
				const cacheType = configService.get<string>("CACHE_TYPE", "memory");

				const config: CacheConfig = {
					type: cacheType as "memory" | "redis",
					defaultTtlMs: configService.get<number>(
						"CACHE_DEFAULT_TTL_MS",
						60_000,
					),
					maxItems: configService.get<number>("CACHE_MAX_ITEMS", 1000),
					redis:
						cacheType === "redis"
							? {
									host: configService.get<string>("REDIS_HOST", "localhost"),
									port: configService.get<number>("REDIS_PORT", 6379),
									password: configService.get<string>("REDIS_PASSWORD"),
									db: configService.get<number>("REDIS_DB", 0),
								}
							: undefined,
				};

				if (config.type === "redis" && config.redis) {
					return new RedisCacheAdapter(config);
				}

				return new InMemoryCacheAdapter({
					defaultTtlMs: config.defaultTtlMs,
					maxItems: config.maxItems,
				});
			},
			inject: [ConfigService],
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
