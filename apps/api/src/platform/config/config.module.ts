import { Global, Inject, Logger, Module, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigModule as NestConfigModule, type ConfigType } from "@nestjs/config";

import { appConfig, type AppSettings } from "./app.config.js";
import { cacheConfig } from "./cache.config.js";
import { ConfigLogEvent } from "./config.log-events.js";
import { databaseConfig } from "./database.config.js";
import { encryptionConfig } from "./encryption.config.js";
import { processEnv } from "./env.js";
import { jobConfig } from "./job.config.js";
import { jwtConfig } from "./jwt.config.js";
import { redisConfig } from "./redis.config.js";
import { validateEnv } from "./schemas/index.js";
import { productionConfigWarnings } from "./schemas/production-readiness.js";
import { sentryConfig } from "./sentry.config.js";
import { throttleConfig } from "./throttle.config.js";

/**
 * 환경변수 설정 모듈
 *
 * 환경별 .env 파일을 로드하고 Zod로 검증합니다. 운영에서 위험한 조합이면 시작을 거부하고
 * (schemas/production-readiness.ts), 권장 값이 비면 시작 뒤 경고를 남깁니다.
 * - production: .env
 * - test: .env.test
 * - development: .env.development
 *
 * @Global() 데코레이터로 전역 모듈로 등록됩니다.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePath(),
      validate: validateEnv,
      ignoreEnvFile: false,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        sentryConfig,
        cacheConfig,
        encryptionConfig,
        jobConfig,
        throttleConfig,
      ],
    }),
  ],
})
export class AppConfigModule implements OnApplicationBootstrap {
  readonly #logger = new Logger(AppConfigModule.name);
  readonly #warnings: readonly string[];

  constructor(
    @Inject(appConfig.KEY) app: Pick<AppSettings, "environment">,
    @Inject(sentryConfig.KEY) sentry: Pick<ConfigType<typeof sentryConfig>, "dsn">,
  ) {
    this.#warnings = productionConfigWarnings({
      environment: app.environment,
      sentryDsn: sentry.dsn,
    });
  }

  onApplicationBootstrap(): void {
    for (const key of this.#warnings) {
      this.#logger.warn({ event: ConfigLogEvent.RECOMMENDED_VALUE_MISSING, key });
    }
  }
}

/**
 * NODE_ENV에 따른 .env 파일 경로 반환. 설정을 읽기 전에 정해야 해서 배포 환경이 아니라 런타임 모드를 본다.
 *
 * - production → .env
 * - test → .env.test (외부 서비스 비활성)
 * - development → .env.development
 */
function getEnvFilePath(): string {
  const env = processEnv.NODE_ENV ?? "development";
  if (env === "production") {
    return ".env";
  }
  if (env === "test") {
    return ".env.test";
  }
  return ".env.development";
}
