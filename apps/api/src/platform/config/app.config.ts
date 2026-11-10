import { defineConfig } from "./define-config.js";
import { type AppEnvironment, appSchema } from "./schemas/app.schema.js";
import { corsSchema } from "./schemas/security.schema.js";

/**
 * 배포 환경의 단일 원본과 프로세스 전체가 쓰는 포트·CORS·로그 수준. 개발서버도 production 빌드(NODE_ENV=production)로
 * 돌아 APP_ENV가 우선이고, APP_ENV가 없던 기존 운영 배포와 로컬·테스트는 NODE_ENV로 정한다(production이 아니면 development).
 */
export const appConfig = defineConfig(
  "app",
  appSchema
    .pick({ NODE_ENV: true, APP_ENV: true, INSTANCE_ID: true, PORT: true, LOG_LEVEL: true })
    .extend(corsSchema.shape)
    .transform((env) => {
      const environment: AppEnvironment =
        env.APP_ENV ?? (env.NODE_ENV === "production" ? "production" : "development");
      return {
        nodeEnv: env.NODE_ENV,
        environment,
        isProduction: environment === "production",
        isDevelopment: environment === "development",
        port: env.PORT,
        corsOrigins: env.CORS_ORIGINS,
        instanceId: env.INSTANCE_ID,
        logLevel: env.LOG_LEVEL,
      };
    }),
  (env) => ({
    NODE_ENV: env.NODE_ENV,
    APP_ENV: env.APP_ENV,
    INSTANCE_ID: env.INSTANCE_ID,
    PORT: env.PORT,
    LOG_LEVEL: env.LOG_LEVEL,
    CORS_ORIGINS: env.CORS_ORIGINS,
  }),
);
