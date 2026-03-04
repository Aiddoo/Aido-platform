import {
	type DynamicModule,
	Global,
	Logger,
	Module,
	type OnModuleDestroy,
	type Provider,
} from "@nestjs/common";
import Redis from "ioredis";
import { TypedConfigService } from "../config/services/config.service";
import { REDIS_CLIENT } from "./redis.constants";

/**
 * Redis 모듈
 *
 * 공유 ioredis 인스턴스를 제공하는 글로벌 모듈.
 * Lock, Cache, BullMQ가 동일한 Redis 연결을 공유합니다.
 *
 * @example
 * // app.module.ts
 * imports: [RedisModule.forRoot()]
 *
 * @example
 * // 서비스에서 직접 사용 (일반적으로 Lock/Cache 어댑터를 통해 접근)
 * constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
 */
@Global()
@Module({})
export class RedisModule implements OnModuleDestroy {
	private static logger = new Logger(RedisModule.name);
	private static client: Redis | null = null;

	static forRoot(): DynamicModule {
		const redisProvider: Provider = {
			provide: REDIS_CLIENT,
			useFactory: (configService: TypedConfigService): Redis => {
				const url = configService.redisUrl;

				const client = url
					? new Redis(url, {
							maxRetriesPerRequest: null,
							enableReadyCheck: true,
							connectionName: "aido-main",
						})
					: new Redis({
							host: configService.redis.host ?? "localhost",
							port: configService.redis.port ?? 6379,
							password: configService.redis.password,
							db: configService.redis.db ?? 0,
							maxRetriesPerRequest: null,
							enableReadyCheck: true,
							connectionName: "aido-main",
						});

				client.on("connect", () => {
					RedisModule.logger.log("Redis connected");
				});

				client.on("error", (error) => {
					RedisModule.logger.error(`Redis error: ${error.message}`);
				});

				client.on("close", () => {
					RedisModule.logger.warn("Redis connection closed");
				});

				RedisModule.client = client;
				return client;
			},
			inject: [TypedConfigService],
		};

		return {
			module: RedisModule,
			providers: [TypedConfigService, redisProvider],
			exports: [REDIS_CLIENT],
		};
	}

	/**
	 * 테스트용 모듈 설정
	 */
	static forTesting(client: Redis): DynamicModule {
		return {
			module: RedisModule,
			providers: [{ provide: REDIS_CLIENT, useValue: client }],
			exports: [REDIS_CLIENT],
		};
	}

	async onModuleDestroy(): Promise<void> {
		if (RedisModule.client) {
			await RedisModule.client.quit();
			RedisModule.client = null;
			RedisModule.logger.log("Redis disconnected");
		}
	}
}
