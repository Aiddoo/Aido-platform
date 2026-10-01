import {
	BadRequestException,
	type INestApplication,
	StandardSchemaValidationPipe,
} from "@nestjs/common";
import helmet from "helmet";

import type { EnvConfig } from "#api/shared/infrastructure/config/index";
import { createCorsOptions } from "#api/shared/infrastructure/config/utils/cors-options";

import { configureRequestIdentity } from "./configure-request-identity.js";

export interface ApplicationConfiguration {
	nodeEnv: EnvConfig["NODE_ENV"];
	corsOrigins: string[];
	enableShutdownHooks?: boolean;
}

/**
 * 운영 서버와 HTTP E2E가 공유하는 애플리케이션 경계 설정.
 *
 * 필터와 인터셉터는 AppModule의 APP_FILTER/APP_INTERCEPTOR provider로 등록되므로
 * 여기서 중복 등록하지 않는다.
 */
export function configureApplication(
	app: INestApplication,
	config: ApplicationConfiguration,
): void {
	configureRequestIdentity(app);
	app.use(helmet());
	app.enableCors(createCorsOptions(config.nodeEnv, config.corsOrigins));
	app.useGlobalPipes(
		new StandardSchemaValidationPipe({
			exceptionFactory: (issues) =>
				new BadRequestException({
					statusCode: 400,
					message: "Validation failed",
					errors: issues,
				}),
		}),
	);
	app.setGlobalPrefix("v1", { exclude: ["health"] });

	if (config.enableShutdownHooks !== false) {
		app.enableShutdownHooks();
	}
}
