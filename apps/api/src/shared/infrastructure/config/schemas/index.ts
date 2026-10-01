import { z } from "zod";

import {
	type AppVersionConfig,
	appVersionSchema,
	validateAppVersionConfig,
} from "./app-version.schema.js";
import { type AppConfig, appSchema } from "./app.schema.js";
import { type CacheEnvConfig, cacheSchema } from "./cache.schema.js";
import { type DatabaseConfig, databaseSchema } from "./database.schema.js";
import { type EmailConfig, emailSchema, validateEmailForProduction } from "./email.schema.js";
import { type ExternalConfig, externalSchema } from "./external.schema.js";
import {
	type FeatureDiscoveryConfig,
	featureDiscoverySchema,
	validateFeatureDiscoveryConfig,
} from "./feature-discovery.schema.js";
import { type JobConfig, jobSchema } from "./job.schema.js";
import { type JwtConfig, jwtSchema } from "./jwt.schema.js";
import { type OAuthConfig, oauthSchema, validateOAuthForProduction } from "./oauth.schema.js";
import { type PushConfig, pushSchema } from "./push.schema.js";
import { type RetentionConfig, retentionSchema } from "./retention.schema.js";
import { type SecurityConfig, securitySchema } from "./security.schema.js";
import { type WebhookConfig, webhookSchema } from "./webhook.schema.js";

// 스키마 재export
export * from "./app.schema.js";
export * from "./app-version.schema.js";
export * from "./cache.schema.js";
export * from "./database.schema.js";
export * from "./email.schema.js";
export * from "./external.schema.js";
export * from "./feature-discovery.schema.js";
export * from "./job.schema.js";
export * from "./jwt.schema.js";
export * from "./oauth.schema.js";
export * from "./push.schema.js";
export * from "./retention.schema.js";
export * from "./security.schema.js";
export * from "./webhook.schema.js";

/**
 * 통합 환경변수 스키마
 */
export const envSchema = z
	.object({})
	.merge(appSchema)
	.merge(appVersionSchema)
	.merge(cacheSchema)
	.merge(databaseSchema)
	.merge(emailSchema)
	.merge(jwtSchema)
	.merge(jobSchema)
	.merge(oauthSchema)
	.merge(securitySchema)
	.merge(pushSchema)
	.merge(retentionSchema)
	.merge(externalSchema)
	.merge(webhookSchema)
	.merge(featureDiscoverySchema)
	.superRefine(validateFeatureDiscoveryConfig)
	.superRefine(validateAppVersionConfig);

/**
 * 환경변수 전체 타입
 */
export type EnvConfig = AppConfig &
	AppVersionConfig &
	CacheEnvConfig &
	DatabaseConfig &
	EmailConfig &
	JwtConfig &
	JobConfig &
	OAuthConfig &
	SecurityConfig &
	PushConfig &
	RetentionConfig &
	ExternalConfig &
	WebhookConfig &
	FeatureDiscoveryConfig;

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

	// Production 환경에서 OAuth 및 이메일 검증
	if (validatedConfig.NODE_ENV === "production") {
		if (!validateOAuthForProduction(validatedConfig)) {
			throw new Error(
				"Production environment requires at least one OAuth provider configured (Google, Apple, Kakao, or Naver)",
			);
		}

		if (!validateEmailForProduction(validatedConfig)) {
			throw new Error(
				"Production environment requires RESEND_API_KEY to be configured for email verification",
			);
		}
	}

	return validatedConfig as EnvConfig;
}
