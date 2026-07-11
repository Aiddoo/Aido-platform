import {
	type DynamicModule,
	Global,
	Module,
	type Provider,
} from "@nestjs/common";
import type Redis from "ioredis";
import { TypedConfigService } from "../config/services/config.service";
import { REDIS_COMMAND_CLIENT } from "../redis/redis.constants";
import { InMemoryLockAdapter } from "./adapters/in-memory-lock.adapter";
import { RedisLockAdapter } from "./adapters/redis-lock.adapter";
import { type ILockProvider, LOCK_PROVIDER } from "./interfaces/lock.interface";

/**
 * 잠금 모듈
 *
 * 환경변수 기반으로 인메모리/Redis 어댑터 선택
 *
 * @example
 * // app.module.ts
 * imports: [LockModule.forRoot()]
 *
 * @example
 * // 테스트에서
 * imports: [LockModule.forTesting(mockAdapter)]
 */
@Global()
@Module({})
export class LockModule {
	/**
	 * 프로덕션용 모듈 설정
	 *
	 * 환경변수:
	 * - CACHE_TYPE: 'memory' | 'redis' (기본값: 'memory')
	 *   캐시와 동일한 환경변수를 사용하여 인프라 일관성 유지
	 */
	static forRoot(): DynamicModule {
		const lockProvider: Provider = {
			provide: LOCK_PROVIDER,
			useFactory: (
				configService: TypedConfigService,
				redis?: Redis,
			): ILockProvider => {
				const cacheType = configService.cache.type;

				if (cacheType === "redis" && redis) {
					return new RedisLockAdapter(redis);
				}

				return new InMemoryLockAdapter();
			},
			inject: [
				TypedConfigService,
				{ token: REDIS_COMMAND_CLIENT, optional: true },
			],
		};

		return {
			module: LockModule,
			providers: [TypedConfigService, lockProvider],
			exports: [LOCK_PROVIDER],
		};
	}

	/**
	 * 테스트용 모듈 설정
	 *
	 * 특정 어댑터를 직접 주입하여 사용
	 *
	 * @example
	 * const mockAdapter = { acquire: jest.fn(), isLocked: jest.fn() };
	 * const module = await Test.createTestingModule({
	 *   imports: [LockModule.forTesting(mockAdapter)],
	 * }).compile();
	 */
	static forTesting(adapter: ILockProvider): DynamicModule {
		return {
			module: LockModule,
			providers: [{ provide: LOCK_PROVIDER, useValue: adapter }],
			exports: [LOCK_PROVIDER],
		};
	}
}
