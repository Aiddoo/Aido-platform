import {
	type DynamicModule,
	Global,
	Inject,
	Logger,
	Module,
	type OnApplicationShutdown,
	Optional,
	type Provider,
} from "@nestjs/common";
import Redis, { type RedisOptions } from "ioredis";
import { TypedConfigService } from "../config/services/config.service";
import { withTimeout } from "../utils/with-timeout.util";
import { REDIS_CLIENT, REDIS_COMMAND_CLIENT } from "./redis.constants";
import {
	buildBullRedisOptions,
	buildCommandRedisOptions,
	type RedisConnectionSettings,
} from "./redis-client.factory";

/** quit이 오프라인 큐에 걸려 hang할 때 disconnect로 폴백하기까지의 대기 시간 */
const QUIT_TIMEOUT_MS = 3_000;

/**
 * 종료 처리에 필요한 최소 클라이언트 계약
 *
 * ioredis Redis가 구조적으로 만족하며, 테스트에서 캐스트 없이
 * fake를 주입할 수 있도록 좁혀 둔다.
 */
export interface RedisLifecycleClient {
	status: string;
	quit(): Promise<"OK">;
	disconnect(reconnect?: boolean): void;
}

/**
 * Redis 모듈
 *
 * 용도별로 분리된 두 ioredis 인스턴스를 제공하는 글로벌 모듈:
 * - `REDIS_CLIENT`: BullMQ 전용 (블로킹 명령 호환 — 오프라인 큐 유지)
 * - `REDIS_COMMAND_CLIENT`: 캐시/락/스로틀/dedup용 (fail-fast —
 *   Redis 단절 시 명령이 즉시 reject되어 어댑터의 fail-open이 작동)
 *
 * @example
 * // app.module.ts
 * imports: [RedisModule.forRoot()]
 *
 * @example
 * // 서비스에서 직접 사용 (일반적으로 Lock/Cache 어댑터를 통해 접근)
 * constructor(@Inject(REDIS_COMMAND_CLIENT) private readonly redis: Redis) {}
 */
@Global()
@Module({})
export class RedisModule implements OnApplicationShutdown {
	private static readonly logger = new Logger(RedisModule.name);
	private shutdownPromise: Promise<void> | null = null;

	constructor(
		@Optional()
		@Inject(REDIS_CLIENT)
		private readonly bullClient: RedisLifecycleClient | null,
		@Optional()
		@Inject(REDIS_COMMAND_CLIENT)
		private readonly commandClient: RedisLifecycleClient | null,
	) {}

	static forRoot(): DynamicModule {
		const bullProvider: Provider = {
			provide: REDIS_CLIENT,
			useFactory: (configService: TypedConfigService): Redis =>
				RedisModule.createClient(configService, buildBullRedisOptions, "main"),
			inject: [TypedConfigService],
		};

		const commandProvider: Provider = {
			provide: REDIS_COMMAND_CLIENT,
			useFactory: (configService: TypedConfigService): Redis =>
				RedisModule.createClient(
					configService,
					buildCommandRedisOptions,
					"command",
				),
			inject: [TypedConfigService],
		};

		return {
			module: RedisModule,
			providers: [TypedConfigService, bullProvider, commandProvider],
			exports: [REDIS_CLIENT, REDIS_COMMAND_CLIENT],
		};
	}

	/**
	 * 테스트용 모듈 설정
	 *
	 * @param client BullMQ용 클라이언트
	 * @param commandClient 명령용 클라이언트 (생략 시 client 재사용)
	 */
	static forTesting(
		client: Redis,
		commandClient: Redis = client,
	): DynamicModule {
		return {
			module: RedisModule,
			providers: [
				{ provide: REDIS_CLIENT, useValue: client },
				{ provide: REDIS_COMMAND_CLIENT, useValue: commandClient },
			],
			exports: [REDIS_CLIENT, REDIS_COMMAND_CLIENT],
		};
	}

	/**
	 * BullMQ Worker/Queue가 같은 훅에서 먼저 정리된 뒤(Nest가 의존 역순 호출)
	 * 연결을 닫는다 — onModuleDestroy에서 닫으면 in-flight 명령이
	 * "Connection is closed." unhandled rejection을 일으킨다.
	 */
	async onApplicationShutdown(): Promise<void> {
		// main.ts의 enableShutdownHooks + 자체 SIGTERM 핸들러가 app.close()를
		// 중복 호출할 수 있으므로 멱등하게 처리한다
		this.shutdownPromise ??= this.closeClients();
		await this.shutdownPromise;
	}

	private async closeClients(): Promise<void> {
		await Promise.allSettled([
			this.shutdownClient(this.commandClient, "command"),
			this.shutdownClient(this.bullClient, "main"),
		]);
	}

	private async shutdownClient(
		client: RedisLifecycleClient | null,
		name: string,
	): Promise<void> {
		if (!client || client.status === "end") {
			return;
		}

		try {
			// Redis 다운 중 종료 시 quit이 오프라인 큐에 걸려 hang할 수 있다
			await withTimeout(client.quit(), QUIT_TIMEOUT_MS, "Redis quit");
			RedisModule.logger.log(`Redis[${name}] disconnected`);
		} catch {
			client.disconnect();
			RedisModule.logger.warn(`Redis[${name}] force-disconnected`);
		}
	}

	private static createClient(
		configService: TypedConfigService,
		buildOptions: (settings: RedisConnectionSettings) => RedisOptions,
		name: string,
	): Redis {
		const settings: RedisConnectionSettings = {
			url: configService.redisUrl,
			...configService.redis,
		};

		const options = buildOptions(settings);
		const client = settings.url
			? new Redis(settings.url, options)
			: new Redis(options);

		client.on("connect", () => {
			RedisModule.logger.log(`Redis[${name}] connected`);
		});

		client.on("error", (error) => {
			RedisModule.logger.error(`Redis[${name}] error: ${error.message}`);
		});

		client.on("close", () => {
			RedisModule.logger.warn(`Redis[${name}] connection closed`);
		});

		return client;
	}
}
