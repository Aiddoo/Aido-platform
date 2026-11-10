import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "./define-config.js";
import {
  type AppEnvironment,
  appSchema,
  type NodeEnvironment,
  resolveAppEnvironment,
} from "./schemas/app.schema.js";
import { corsSchema } from "./schemas/security.schema.js";

/** 개발 환경에서만 켜는 동작. 코드는 환경 이름 대신 이 스위치를 읽고, 스테이징·운영에서는 모두 꺼진다. */
export interface DevTools {
  /** 오류 응답에 원문 메시지·검증 상세·DB 정보를 싣는다 */
  readonly exposeErrorDetails: boolean;
  /** /api/docs·/api/admin/docs Swagger UI를 연다 */
  readonly swaggerUi: boolean;
  /** OAuth 복귀 주소로 aido-dev://·localhost·exp:// 를 받는다 */
  readonly oauthDevRedirects: boolean;
  /** CORS 허용 출처에 localhost 개발 서버를 더한다 */
  readonly localCorsOrigins: boolean;
}

export function resolveDevTools(input: {
  readonly environment: AppEnvironment;
  readonly nodeEnv: NodeEnvironment;
}): DevTools {
  // 테스트 실행(NODE_ENV=test)은 출시 응답 계약을 검증하므로 개발 환경이어도 끈다
  const enabled = input.environment === "development" && input.nodeEnv !== "test";
  return {
    exposeErrorDetails: enabled,
    swaggerUi: enabled,
    oauthDevRedirects: enabled,
    localCorsOrigins: enabled,
  };
}

/**
 * 배포 환경의 단일 원본과 프로세스 전체가 쓰는 포트·CORS·로그 수준. 개발서버도 production 빌드(NODE_ENV=production)로
 * 돌아 APP_ENV가 우선이다. 런타임 판단은 environment·isProduction·devTools를 읽고, nodeEnv는 실행 방식(소스·테스트·빌드)이
 * 정하는 곳만 읽는다.
 */
export const appConfig = defineConfig(
  "app",
  appSchema
    .pick({ NODE_ENV: true, APP_ENV: true, INSTANCE_ID: true, PORT: true, LOG_LEVEL: true })
    .extend(corsSchema.shape)
    .transform((env) => {
      const environment = resolveAppEnvironment(env);
      return {
        nodeEnv: env.NODE_ENV,
        environment,
        isProduction: environment === "production",
        devTools: resolveDevTools({ environment, nodeEnv: env.NODE_ENV }),
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

export type AppSettings = ConfigType<typeof appConfig>;
