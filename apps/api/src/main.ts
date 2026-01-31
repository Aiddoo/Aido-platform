import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { cleanupOpenApiDoc, ZodValidationPipe } from "nestjs-zod";

import type { EnvConfig } from "@/common/config";
import { SWAGGER_TAG_DESCRIPTIONS, SWAGGER_TAGS } from "@/common/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { bufferLogs: true });

	const configService = app.get(ConfigService<EnvConfig, true>);
	const port = configService.get("PORT", { infer: true });
	const nodeEnv = configService.get("NODE_ENV", { infer: true });
	const corsOrigins = configService.get("CORS_ORIGINS", { infer: true });

	app.useLogger(app.get(Logger));

	app.use(helmet());
	app.enableCors({
		origin: nodeEnv === "development" ? true : corsOrigins, // 개발 환경에서는 모든 origin 허용
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	});

	app.useGlobalPipes(new ZodValidationPipe());

	// API 버전 프리픽스 설정 (/v1)
	// health 엔드포인트는 프리픽스 제외
	app.setGlobalPrefix("v1", {
		exclude: ["health"],
	});

	if (nodeEnv !== "production") {
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
  "timestamp": "2024-01-15T09:00:00.000Z"
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
  "timestamp": "2024-01-15T09:00:00.000Z"
}
\`\`\`

## 인증
- **Bearer Token 방식** (JWT)
- 헤더: \`Authorization: Bearer {token}\`
- 토큰 갱신: \`POST /v1/auth/refresh\`

## API 버저닝
- 모든 API는 \`/v1\` 프리픽스 사용
- Health 체크만 예외: \`GET /health\`
`)
			.setVersion("1.0.0")
			// 환경별 서버 URL
			.addServer("http://localhost:8080", "Local Development")
			.addServer("https://api-staging.aido.app", "Staging")
			.addServer("https://api.aido.app", "Production")
			.addBearerAuth({
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description: "JWT 토큰을 입력하세요",
			})
			// 핵심 기능 APIs
			.addTag(
				SWAGGER_TAGS.USER_AUTH,
				SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.USER_AUTH],
			)
			.addTag(SWAGGER_TAGS.TODOS, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.TODOS])
			.addTag(SWAGGER_TAGS.AI, SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.AI])
			// 소셜 기능 APIs
			.addTag(
				SWAGGER_TAGS.FOLLOWS,
				SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.FOLLOWS],
			)
			.addTag(
				SWAGGER_TAGS.CHEERS,
				SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.CHEERS],
			)
			.addTag(
				SWAGGER_TAGS.NUDGES,
				SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.NUDGES],
			)
			// 통계 APIs
			.addTag(
				SWAGGER_TAGS.DAILY_COMPLETIONS,
				SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.DAILY_COMPLETIONS],
			)
			// 시스템 APIs
			.addTag(
				SWAGGER_TAGS.COMMON_HEALTH,
				SWAGGER_TAG_DESCRIPTIONS[SWAGGER_TAGS.COMMON_HEALTH],
			)
			.build();

		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup("api/docs", app, cleanupOpenApiDoc(document), {
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
				// 요청 시간 표시로 성능 모니터링 지원
				displayRequestDuration: true,
				syntaxHighlight: {
					activate: true,
					theme: "monokai",
				},
				// 코드 스니펫 활성화 - 클라이언트 개발자가 바로 복사해서 사용 가능
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

	await app.listen(port);

	const logger = app.get(Logger);
	logger.log(`🚀 Server running on http://localhost:${port}`);
	logger.log(`📚 API Docs: http://localhost:${port}/api/docs`);
	logger.log(`💊 Health Check: http://localhost:${port}/health`);
}

bootstrap();
