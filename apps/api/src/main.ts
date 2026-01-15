import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { cleanupOpenApiDoc, ZodValidationPipe } from "nestjs-zod";

import type { EnvConfig } from "@/common/config";
import { SWAGGER_TAGS } from "@/common/swagger";
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
		origin: corsOrigins, // 이미 배열로 변환됨
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
			.setDescription("AI TodoList 앱을 위한 백엔드 API")
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
			// User APIs (클라이언트 앱용)
			.addTag(
				SWAGGER_TAGS.USER_AUTH,
				"회원가입, 로그인, 토큰 갱신, 로그아웃 API",
			)
			.addTag(SWAGGER_TAGS.USER_TODO, "Todo CRUD 및 페이지네이션 API")
			// Admin APIs (관리자/백오피스용) - 추후 확장 시 주석 해제
			// .addTag(SWAGGER_TAGS.ADMIN_USERS, "사용자 관리 API")
			// .addTag(SWAGGER_TAGS.ADMIN_SYSTEM, "시스템 설정 API")
			// Common APIs
			.addTag(SWAGGER_TAGS.COMMON_HEALTH, "서버 상태 및 헬스체크 API")
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
				displayOperationId: false,
				syntaxHighlight: {
					activate: true,
					theme: "monokai",
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
