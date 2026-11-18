import { ErrorCode, Errors } from "@aido/api/errors";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppConfigAppReleasesAdminModule } from "#api/modules/app-config/app-releases/app-config-app-releases.public";
// identity-users.public이 이 Module을 열면 사용자 providers가 social·operations public을 거쳐 그 public으로 돌아와 파일 순환이다
import { IdentityUsersAdminModule } from "#api/modules/identity/users/identity-users-admin.module";
import { OperationsBroadcastCampaignsModule } from "#api/modules/operations/broadcast-campaigns/operations-broadcast-campaigns.public";
import { SocialUserReportsAdminModule } from "#api/modules/social/user-reports/social-user-reports.public";
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

const APP_DOCS_DESCRIPTION = `AI TodoList 앱을 위한 백엔드 API

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
`;

function adminDocsDescription(): string {
  return `관리자 전용 API

## 인증
- **Bearer Token 방식** (JWT)
- **ADMIN 역할 필수**: role이 ADMIN인 사용자만 접근 가능
- 헤더: \`Authorization: Bearer {token}\`

## 에러 코드
${adminErrorCodeTable()}
`;
}

function withServers(builder: DocumentBuilder): DocumentBuilder {
  return builder
    .addServer("http://localhost:8080", "Local Development")
    .addServer("https://api-staging.aido.kr", "Staging")
    .addServer("https://api.aido.kr", "Production");
}

function setupAppDocs(app: INestApplication, apiVersion: string): void {
  const config = withServers(
    new DocumentBuilder()
      .setTitle("Aido API")
      .setDescription(APP_DOCS_DESCRIPTION)
      .setVersion(apiVersion),
  )
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT 토큰을 입력하세요",
    })
    .addTag(SWAGGER_TAGS.USER_AUTH, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.USER_AUTH])
    .addTag(SWAGGER_TAGS.TODOS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.TODOS])
    .addTag(SWAGGER_TAGS.TODO_CATEGORIES, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.TODO_CATEGORIES])
    .addTag(SWAGGER_TAGS.TODO_COMMENTS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.TODO_COMMENTS])
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
    .addTag(
      SWAGGER_TAGS.WEATHER_DEPRECATED,
      SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.WEATHER_DEPRECATED],
    )
    .addTag(SWAGGER_TAGS.WEATHER, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.WEATHER])
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
}

function setupAdminDocs(app: INestApplication, apiVersion: string): void {
  const adminConfig = withServers(
    new DocumentBuilder()
      .setTitle("Aido Admin API")
      .setDescription(adminDocsDescription())
      .setVersion(apiVersion),
  )
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
      AppConfigAppReleasesAdminModule,
      IdentityUsersAdminModule,
      OperationsBroadcastCampaignsModule,
      SocialUserReportsAdminModule,
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
  setupAppDocs(app, apiVersion);
  setupAdminDocs(app, apiVersion);
  return `/${APP_DOCS_PATH}`;
}
