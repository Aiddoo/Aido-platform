import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";

import { appConfig } from "./app.config.js";
import { cacheConfig } from "./cache.config.js";
import { databaseConfig } from "./database.config.js";
import { encryptionConfig } from "./encryption.config.js";
import { processEnv } from "./env.js";
import { jobConfig } from "./job.config.js";
import { jwtConfig } from "./jwt.config.js";
import { redisConfig } from "./redis.config.js";
import { validateEnv } from "./schemas/index.js";
import { sentryConfig } from "./sentry.config.js";
import { TypedConfigService } from "./services/config.service.js";
import { throttleConfig } from "./throttle.config.js";

/**
 * 환경변수 설정 모듈
 *
 * 환경별 .env 파일을 로드하고 Zod로 검증합니다.
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
  providers: [TypedConfigService],
  exports: [TypedConfigService],
})
export class AppConfigModule {}

/**
 * NODE_ENV에 따른 .env 파일 경로 반환
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
