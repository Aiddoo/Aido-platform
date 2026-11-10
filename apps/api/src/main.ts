import "./shared/domain/date/dayjs.setup.js";
import type { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";

import { OperationsBroadcastsModule } from "#api/modules/operations/broadcasts/operations-broadcasts.public";
import { OperationsMetricsModule } from "#api/modules/operations/metrics/operations-metrics.public";
import { SocialReportsAdminModule } from "#api/modules/social/reports/social-reports.public";
import { appConfig } from "#api/platform/config/app.config";
import { processEnv } from "#api/platform/config/env";
import { configureApplication } from "#api/platform/http/configure-application";
import { SWAGGER_TAG_DESCRIPTIONS, SWAGGER_TAGS } from "#api/platform/http/swagger/index";
import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { flushExceptionReports } from "#api/platform/observability/sentry-scope";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { AppModule } from "./app.module.js";
import { convertStandardSchema } from "./platform/http/swagger/standard-schema.converter.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const { port, nodeEnv, corsOrigins } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.useLogger(app.get(Logger));

  configureApplication(app, {
    nodeEnv,
    corsOrigins,
    enableShutdownHooks: false,
  });

  if (nodeEnv === "development") {
    const apiVersion = processEnv.npm_package_version ?? "development";
    const config = new DocumentBuilder()
      .setTitle("Aido API")
      .setDescription(`AI TodoList 앱을 위한 백엔드 API

## 공통 응답 형식

모든 API 응답은 \`ResponseTransformInterceptor\`에 의해 다음 구조로 래핑됩니다:

### ✅ 성공 응답
\`\`\`json
{
  "success": true,
  "data": { ... },
  "timestamp": 1705309200000
}
\`\`\`

### ❌ 에러 응답
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  },
  "timestamp": 1705309200000
}
\`\`\`

## 인증
- **Bearer Token 방식** (JWT)
- 헤더: \`Authorization: Bearer {token}\`
- 토큰 갱신: \`POST /v1/auth/refresh\`

## API 버저닝
- 경로에 버전을 둡니다(\`/v1\`, \`/v2\`). Deprecated 표시된 작업은 설명에 적힌 앱 버전까지만 지원합니다.
- Health 체크만 예외: \`GET /health\`
`)
      .setVersion(apiVersion)
      .addServer("http://localhost:8080", "Local Development")
      .addServer("https://api-staging.aido.kr", "Staging")
      .addServer("https://api.aido.kr", "Production")
      .addBearerAuth({
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT 토큰을 입력하세요",
      })
      .addTag(SWAGGER_TAGS.USER_AUTH, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.USER_AUTH])
      .addTag(SWAGGER_TAGS.TODOS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.TODOS])
      .addTag(SWAGGER_TAGS.TODO_CATEGORIES, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.TODO_CATEGORIES])
      .addTag(
        SWAGGER_TAGS.TODO_COMMENTS_V2,
        SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.TODO_COMMENTS_V2],
      )
      .addTag(SWAGGER_TAGS.AI, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.AI])
      .addTag(SWAGGER_TAGS.ENTITLEMENTS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.ENTITLEMENTS])
      .addTag(SWAGGER_TAGS.FOLLOWS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.FOLLOWS])
      .addTag(SWAGGER_TAGS.CHEERS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.CHEERS])
      .addTag(SWAGGER_TAGS.NUDGES, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.NUDGES])
      .addTag(SWAGGER_TAGS.NOTIFICATIONS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.NOTIFICATIONS])
      .addTag(SWAGGER_TAGS.BLOCKS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.BLOCKS])
      .addTag(SWAGGER_TAGS.REPORTS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.REPORTS])
      .addTag(
        SWAGGER_TAGS.DAILY_COMPLETIONS,
        SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.DAILY_COMPLETIONS],
      )
      .addTag(SWAGGER_TAGS.WEATHER_V1, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.WEATHER_V1])
      .addTag(SWAGGER_TAGS.WEATHER_V2, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.WEATHER_V2])
      .addTag(SWAGGER_TAGS.COMMON_HEALTH, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.COMMON_HEALTH])
      .build();

    // App API 문서 (일반 클라이언트용)
    const appDocument = SwaggerModule.createDocument(app, config, {
      standardSchemaConverter: convertStandardSchema,
    });
    SwaggerModule.setup("api/docs", app, appDocument, {
      customSiteTitle: "Aido API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: "list",
        filter: true,
        showRequestDuration: true,
        tryItOutEnabled: true,
        operationsSorter: "method",
        tagsSorter: "alpha",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 2,
        // NestJS/Swagger 2026 베스트 프랙티스: operationId 표시로 클라이언트 SDK 생성 지원
        displayOperationId: true,
        displayRequestDuration: true,
        syntaxHighlight: {
          activate: true,
          theme: "monokai",
        },
        requestSnippetsEnabled: true,
        requestSnippets: {
          generators: {
            curl_bash: { title: "cURL (bash)", syntax: "bash" },
            curl_cmd: { title: "cURL (cmd)", syntax: "cmd" },
          },
          defaultExpanded: true,
        },
      },
    });

    // Admin API 문서 (관리자 전용)
    const adminConfig = new DocumentBuilder()
      .setTitle("Aido Admin API")
      .setDescription(`관리자 전용 API

## 인증
- **Bearer Token 방식** (JWT)
- **ADMIN 역할 필수**: role이 ADMIN인 사용자만 접근 가능
- 헤더: \`Authorization: Bearer {token}\`

## 에러 코드
| 코드 | HTTP | 설명 |
|------|------|------|
| ADMIN_1401 | 403 | 관리자 권한이 필요합니다 |
| ADMIN_1402 | 404 | 알림 대상 사용자가 없습니다 |
| ADMIN_1403 | 400 | 유효하지 않은 필터 조건입니다 |
| ADMIN_1404 | 404 | 브로드캐스트 캠페인을 찾을 수 없습니다 |
| ADMIN_1405 | 409 | 같은 요청 ID로 다른 브로드캐스트가 이미 접수되었습니다 |
| REPORT_2255 | 404 | 신고를 찾을 수 없습니다 |
`)
      .setVersion(apiVersion)
      .addServer("http://localhost:8080", "Local Development")
      .addServer("https://api-staging.aido.kr", "Staging")
      .addServer("https://api.aido.kr", "Production")
      .addBearerAuth({
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "관리자 JWT 토큰을 입력하세요 (role: ADMIN)",
      })
      .addTag(
        SWAGGER_TAGS.ADMIN_NOTIFICATIONS,
        SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.ADMIN_NOTIFICATIONS],
      )
      .addTag(SWAGGER_TAGS.ADMIN_USERS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.ADMIN_USERS])
      .addTag(SWAGGER_TAGS.ADMIN_REPORTS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.ADMIN_REPORTS])
      .addTag(SWAGGER_TAGS.ADMIN_SYSTEM, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.ADMIN_SYSTEM])
      .build();

    const adminDocument = SwaggerModule.createDocument(app, adminConfig, {
      include: [OperationsBroadcastsModule, OperationsMetricsModule, SocialReportsAdminModule],
      standardSchemaConverter: convertStandardSchema,
    });
    SwaggerModule.setup("api/admin/docs", app, adminDocument, {
      customSiteTitle: "Aido Admin API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        // 신고 접수 이메일이 처리 API로 바로 이동하는 #/{tag}/{operationId} 링크를 쓴다
        deepLinking: true,
        docExpansion: "list",
        filter: true,
        showRequestDuration: true,
        tryItOutEnabled: true,
        operationsSorter: "method",
        tagsSorter: "alpha",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 2,
        displayOperationId: true,
        displayRequestDuration: true,
        syntaxHighlight: {
          activate: true,
          theme: "monokai",
        },
      },
    });
  }

  await app.listen(port);

  const logger = app.get(Logger);
  logger.log({
    event: PlatformLogEvent.SERVER_STARTED,
    port,
    docsPath: nodeEnv === "development" ? "/api/docs" : undefined,
    healthPath: "/health",
  });

  // Graceful shutdown: NestJS 모듈 종료 (작업 worker 포함) → Sentry flush
  let shutdownStarted = false;
  const shutdown = async (signal: string) => {
    if (shutdownStarted) {
      return;
    }
    shutdownStarted = true;
    logger.log({ event: PlatformLogEvent.SERVER_SHUTDOWN_STARTED, signal });
    try {
      await app.close();
      process.exitCode = 0;
    } catch (error) {
      logger.error({
        event: PlatformLogEvent.SERVER_SHUTDOWN_FAILED,
        errorType: toErrorType(error),
      });
      process.exitCode = 1;
    } finally {
      await flushExceptionReports(2000);
    }
  };
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

await bootstrap();
