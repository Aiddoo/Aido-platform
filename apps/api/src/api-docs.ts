import { ErrorCode, Errors } from "@aido/api/errors";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppConfigAppVersionsAdminModule } from "#api/modules/app-config/app-versions/app-config-app-versions.public";
import { OperationsBroadcastsModule } from "#api/modules/operations/broadcasts/operations-broadcasts.public";
import { OperationsMetricsModule } from "#api/modules/operations/metrics/operations-metrics.public";
import { SocialReportsAdminModule } from "#api/modules/social/reports/social-reports.public";
import { appConfig, type AppSettings } from "#api/platform/config/app.config";
import {
  SWAGGER_TAG_DESCRIPTIONS,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/constants/swagger.constant";

import { convertStandardSchema } from "./platform/http/swagger/standard-schema.converter.js";

const APP_DOCS_PATH = "api/docs";
const ADMIN_DOCS_PATH = "api/admin/docs";

const ADMIN_DOC_ERROR_CODES = [
  ErrorCode.ADMIN_1401,
  ErrorCode.ADMIN_1402,
  ErrorCode.ADMIN_1403,
  ErrorCode.ADMIN_1404,
  ErrorCode.ADMIN_1405,
  ErrorCode.REPORT_2255,
] as const;

function adminErrorCodeTable(): string {
  const rows = ADMIN_DOC_ERROR_CODES.map(
    (code) => `| ${code} | ${Errors[code].httpStatus} | ${Errors[code].message} |`,
  );
  return ["| 코드 | HTTP | 설명 |", "|------|------|------|", ...rows].join("\n");
}

/**
 * 앱·관리자 Swagger UI를 연다. 개발 도구(devTools.swaggerUi)가 꺼진 환경에서는 아무 경로도 열지 않는다.
 * 연 앱 문서 경로를 돌려준다(닫혔으면 undefined).
 */
export function setupApiDocs(app: INestApplication): string | undefined {
  const { devTools } = app.get<AppSettings>(appConfig.KEY);
  if (!devTools.swaggerUi) {
    return undefined;
  }

  // Swagger는 로컬 실행에서만 뜬다. 서버는 버전 번호 없이 커밋 SHA로 식별한다(docs/conventions/git.md)
  const apiVersion = "local";
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
    .addTag(SWAGGER_TAGS.TODO_COMMENTS_V2, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.TODO_COMMENTS_V2])
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
  SwaggerModule.setup(APP_DOCS_PATH, app, appDocument, {
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
${adminErrorCodeTable()}
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
    include: [
      AppConfigAppVersionsAdminModule,
      OperationsBroadcastsModule,
      OperationsMetricsModule,
      SocialReportsAdminModule,
    ],
    standardSchemaConverter: convertStandardSchema,
  });
  SwaggerModule.setup(ADMIN_DOCS_PATH, app, adminDocument, {
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

  return `/${APP_DOCS_PATH}`;
}
