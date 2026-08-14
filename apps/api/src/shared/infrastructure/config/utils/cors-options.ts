import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

import type { EnvConfig } from "../schemas";

const DEVELOPMENT_ORIGINS = [
	"http://localhost:3000",
	"http://localhost:8080",
	"http://localhost:8081",
	"http://localhost:19000",
	"http://localhost:19006",
];

export function createCorsOptions(
	nodeEnv: EnvConfig["NODE_ENV"],
	corsOrigins: string[],
): CorsOptions {
	return {
		origin: nodeEnv === "development" ? DEVELOPMENT_ORIGINS : corsOrigins,
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Timezone"],
	};
}
