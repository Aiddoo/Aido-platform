import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";

import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule, { bufferLogs: true });

	const configService = app.get(ConfigService);
	const port = configService.get<number>("PORT", 8080);
	const nodeEnv = configService.get<string>("NODE_ENV", "development");
	const corsOrigins = configService.get<string>(
		"CORS_ORIGINS",
		"http://localhost:3000",
	);

	app.useLogger(app.get(Logger));

	app.use(helmet());
	app.enableCors({
		origin: corsOrigins.split(",").map((origin) => origin.trim()),
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	});

	app.useGlobalPipes(new ZodValidationPipe());

	if (nodeEnv !== "production") {
		const config = new DocumentBuilder()
			.setTitle("Aido API")
			.setDescription("AI TodoList 앱을 위한 백엔드 API")
			.setVersion("1.0.0")
			.addBearerAuth(
				{
					type: "http",
					scheme: "bearer",
					bearerFormat: "JWT",
					description: "JWT 토큰을 입력하세요",
				},
				"access-token",
			)
			.addTag("Health", "서버 상태 확인 API")
			.addTag("Todo", "할일 관리 API")
			.build();

		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup("api/docs", app, document, {
			swaggerOptions: {
				persistAuthorization: true,
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
