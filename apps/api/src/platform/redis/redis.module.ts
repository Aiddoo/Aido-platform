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
import type { ConfigType } from "@nestjs/config";
import { withTimeout } from "es-toolkit";
import { Redis, type RedisOptions } from "ioredis";

import { cacheConfig } from "../config/cache.config.js";
import { redisConfig } from "../config/redis.config.js";
import { PlatformLogEvent } from "../logging/platform.log-events.js";
import { buildCommandRedisOptions, type RedisConnectionSettings } from "./redis-client.factory.js";
import { REDIS_COMMAND_CLIENT } from "./redis.constants.js";

/** quit이 오프라인 큐에 걸려 hang할 때 disconnect로 폴백하기까지의 대기 시간 */
const QUIT_TIMEOUT_MS = 3000;

const logger = new Logger("RedisModule");

function createRedisClient(
  settings: RedisConnectionSettings,
  buildOptions: (settings: RedisConnectionSettings) => RedisOptions,
  name: string,
): Redis {
  const options = buildOptions(settings);
  const client = settings.url ? new Redis(settings.url, options) : new Redis(options);

  client.on("connect", () => {
    logger.log({ event: PlatformLogEvent.REDIS_CONNECTED, client: name });
  });

  client.on("error", (error) => {
    const code: unknown = Reflect.get(error, "code");
    logger.error({
      event: PlatformLogEvent.REDIS_ERRORED,
      client: name,
      errorType: error.name,
      ...(typeof code === "string" && { networkCode: code }),
    });
  });

  client.on("close", () => {
    logger.warn({ event: PlatformLogEvent.REDIS_CLOSED, client: name });
  });

  return client;
}

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
 * 캐시/락/스로틀/dedup용 ioredis 인스턴스(`REDIS_COMMAND_CLIENT`)를 제공하는 글로벌 모듈.
 * fail-fast 설정이라 Redis 단절 시 명령이 즉시 reject되어 어댑터의 fail-open이 작동한다.
 *
 * @example
 * // app.module.ts
 * imports: [RedisModule.forRoot()]
 *
 * @example
 * // 서비스에서 직접 사용 (일반적으로 Lock/Cache 어댑터를 통해 접근)
 * constructor(@Inject(REDIS_COMMAND_CLIENT) redis: Redis) {}
 */
@Global()
@Module({})
export class RedisModule implements OnApplicationShutdown {
  #shutdownPromise: Promise<void> | null = null;
  readonly #commandClient: RedisLifecycleClient | null;

  constructor(
    @Optional()
    @Inject(REDIS_COMMAND_CLIENT)
    commandClient: RedisLifecycleClient | null,
  ) {
    this.#commandClient = commandClient;
  }

  static forRoot(): DynamicModule {
    const commandProvider: Provider = {
      provide: REDIS_COMMAND_CLIENT,
      useFactory: (
        cache: ConfigType<typeof cacheConfig>,
        redis: ConfigType<typeof redisConfig>,
      ): Redis | null =>
        cache.type === "redis"
          ? createRedisClient(redis, buildCommandRedisOptions, "command")
          : null,
      inject: [cacheConfig.KEY, redisConfig.KEY],
    };

    return {
      module: RedisModule,
      providers: [commandProvider],
      exports: [REDIS_COMMAND_CLIENT],
    };
  }

  static forTesting(commandClient: Redis): DynamicModule {
    return {
      module: RedisModule,
      providers: [{ provide: REDIS_COMMAND_CLIENT, useValue: commandClient }],
      exports: [REDIS_COMMAND_CLIENT],
    };
  }

  /** beforeApplicationShutdown에서 worker drain을 마친 뒤 Redis 연결을 닫는다. */
  async onApplicationShutdown(): Promise<void> {
    this.#shutdownPromise ??= this.#shutdownClient(this.#commandClient, "command");
    await this.#shutdownPromise;
  }

  async #shutdownClient(client: RedisLifecycleClient | null, name: string): Promise<void> {
    if (!client || client.status === "end") {
      return;
    }

    try {
      // Redis 다운 중 종료 시 quit이 오프라인 큐에 걸려 hang할 수 있다
      await withTimeout(() => client.quit(), QUIT_TIMEOUT_MS);
      logger.log({ event: PlatformLogEvent.REDIS_DISCONNECTED, client: name });
    } catch {
      client.disconnect();
      logger.warn({ event: PlatformLogEvent.REDIS_FORCE_DISCONNECTED, client: name });
    }
  }
}
