import { z } from "zod";
import { type AppConfig, appSchema } from "./app.schema";
import { type DatabaseConfig, databaseSchema } from "./database.schema";
import { type ExternalConfig, externalSchema } from "./external.schema";
import { type JwtConfig, jwtSchema } from "./jwt.schema";
import {
	type OAuthConfig,
	oauthSchema,
	validateOAuthForProduction,
} from "./oauth.schema";
import { type PushConfig, pushSchema } from "./push.schema";
import { type SecurityConfig, securitySchema } from "./security.schema";

// 스키마 재export
export * from "./app.schema";
export * from "./database.schema";
export * from "./external.schema";
export * from "./jwt.schema";
export * from "./oauth.schema";
export * from "./push.schema";
export * from "./security.schema";

/**
 * 통합 환경변수 스키마
 */
export const envSchema = z
	.object({})
	.merge(appSchema)
	.merge(databaseSchema)
	.merge(jwtSchema)
	.merge(oauthSchema)
	.merge(securitySchema)
	.merge(pushSchema)
	.merge(externalSchema);

/**
 * 환경변수 전체 타입
 */
export type EnvConfig = AppConfig &
	DatabaseConfig &
	JwtConfig &
	OAuthConfig &
	SecurityConfig &
	PushConfig &
	ExternalConfig;

/**
 * 환경변수 검증 함수
 * @nestjs/config의 validate 옵션에 전달
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
	const result = envSchema.safeParse(config);

	if (!result.success) {
		const errors = result.error.issues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");

		throw new Error(`Environment validation failed:\n${errors}`);
	}

	const validatedConfig = result.data;

	// Production 환경에서 OAuth 검증
	if (validatedConfig.NODE_ENV === "production") {
		if (!validateOAuthForProduction(validatedConfig)) {
			throw new Error(
				"Production environment requires at least one OAuth provider configured (Google, Apple, Kakao, or Naver)",
			);
		}
	}

	return validatedConfig as EnvConfig;
}
