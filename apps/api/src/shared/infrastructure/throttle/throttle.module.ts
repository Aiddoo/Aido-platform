import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type Redis from "ioredis";

import { TypedConfigService } from "../config/services/config.service";
import { REDIS_COMMAND_CLIENT } from "../redis/redis.constants";
import { RedisThrottlerStorage } from "./redis-throttler-storage";
import { THROTTLER_STORAGE } from "./throttle.constants";

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
				configService: TypedConfigService,
				redis?: Redis,
			): ThrottlerStorage | undefined => {
				if (configService.cache.type === "redis" && redis) {
					return new RedisThrottlerStorage(redis);
				}

				return undefined;
			},
			inject: [TypedConfigService, { token: REDIS_COMMAND_CLIENT, optional: true }],
		};

		return {
			module: ThrottleModule,
			providers: [TypedConfigService, storageProvider],
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
