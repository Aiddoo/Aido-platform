import {
	type DynamicModule,
	Global,
	Module,
	type Provider,
} from "@nestjs/common";
import type Redis from "ioredis";
import { TypedConfigService } from "../config/services/config.service";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { InMemoryDedupAdapter } from "./adapters/in-memory-dedup.adapter";
import { RedisDedupAdapter } from "./adapters/redis-dedup.adapter";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "./interfaces/dedup.interface";

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
			provide: DEDUP_PROVIDER,
			useFactory: (
				configService: TypedConfigService,
				redis?: Redis,
			): IDedupProvider => {
				const cacheType = configService.cache.type;

				if (cacheType === "redis" && redis) {
					return new RedisDedupAdapter(redis);
				}

				return new InMemoryDedupAdapter();
			},
			inject: [TypedConfigService, { token: REDIS_CLIENT, optional: true }],
		};

		return {
			module: DedupModule,
			providers: [TypedConfigService, dedupProvider],
			exports: [DEDUP_PROVIDER],
		};
	}

	/**
	 * 테스트용 모듈 설정
	 *
	 * 특정 어댑터를 직접 주입하여 사용
	 *
	 * @example
	 * const mockAdapter = { filterMembers: jest.fn(), isMember: jest.fn(), addMembers: jest.fn() };
	 * const module = await Test.createTestingModule({
	 *   imports: [DedupModule.forTesting(mockAdapter)],
	 * }).compile();
	 */
	static forTesting(adapter: IDedupProvider): DynamicModule {
		return {
			module: DedupModule,
			providers: [{ provide: DEDUP_PROVIDER, useValue: adapter }],
			exports: [DEDUP_PROVIDER],
		};
	}
}
