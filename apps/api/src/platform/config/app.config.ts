import type { z } from "zod";

import { defineConfig } from "./define-config.js";
import { appSchema } from "./schemas/app.schema.js";
import { corsSchema } from "./schemas/security.schema.js";

type DeploymentEnv = NonNullable<z.output<typeof appSchema>["APP_ENV"]>;

// 개발서버도 NODE_ENV=production 빌드라 실제 운영 구분은 APP_ENV다. 없으면 NODE_ENV로 정한다(옛 배포 호환)
function resolveDeploymentEnv(
  appEnv: DeploymentEnv | undefined,
  isProduction: boolean,
): DeploymentEnv {
  return appEnv ?? (isProduction ? "production" : "development");
}

/** 프로세스 전체가 쓰는 실행 모드·포트·CORS·로그 수준. */
export const appConfig = defineConfig(
  "app",
  appSchema
    .pick({ NODE_ENV: true, APP_ENV: true, INSTANCE_ID: true, PORT: true, LOG_LEVEL: true })
    .extend(corsSchema.shape)
    .transform((env) => {
      const isProduction = env.NODE_ENV === "production";
      return {
        nodeEnv: env.NODE_ENV,
        appEnv: resolveDeploymentEnv(env.APP_ENV, isProduction),
        isDevelopment: env.NODE_ENV === "development",
        isProduction,
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
