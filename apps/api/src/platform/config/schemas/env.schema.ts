import { z } from "zod";

import { type AiSuggestionConfig, aiSuggestionSchema } from "./ai-suggestion.schema.js";
import { type AiConfig, aiSchema } from "./ai.schema.js";
import { type AppConfig, appSchema } from "./app.schema.js";
import { type CacheEnvConfig, cacheSchema, validateCacheConfig } from "./cache.schema.js";
import { type DatabaseConfig, databaseSchema } from "./database.schema.js";
import { type EmailConfig, emailSchema } from "./email.schema.js";
import {
  type ExternalConfig,
  externalSchema,
  validateWeatherKitConfig,
} from "./external.schema.js";
import {
  type FeatureDiscoveryConfig,
  featureDiscoverySchema,
  validateFeatureDiscoveryConfig,
} from "./feature-discovery.schema.js";
import { type InviteConfig, inviteSchema, validateInviteConfig } from "./invite.schema.js";
import { type JobConfig, jobSchema } from "./job.schema.js";
import { type JwtConfig, jwtSchema, validateJwtLifetimes } from "./jwt.schema.js";
import { type NudgeConfig, nudgeSchema } from "./nudge.schema.js";
import { type OAuthConfig, oauthSchema } from "./oauth.schema.js";
import { validateProductionReadiness } from "./production-readiness.js";
import { type PushConfig, pushSchema } from "./push.schema.js";
import { type RetentionConfig, retentionSchema } from "./retention.schema.js";
import { type SecurityConfig, securitySchema } from "./security.schema.js";
import { type WebhookConfig, webhookSchema } from "./webhook.schema.js";

export const envSchema = z
  .object({
    ...appSchema.shape,
    ...cacheSchema.shape,
    ...databaseSchema.shape,
    ...emailSchema.shape,
    ...jwtSchema.shape,
    ...jobSchema.shape,
    ...nudgeSchema.shape,
    ...oauthSchema.shape,
    ...securitySchema.shape,
    ...pushSchema.shape,
    ...retentionSchema.shape,
    ...externalSchema.shape,
    ...aiSchema.shape,
    ...aiSuggestionSchema.shape,
    ...webhookSchema.shape,
    ...featureDiscoverySchema.shape,
    ...inviteSchema.shape,
  })
  .check(validateFeatureDiscoveryConfig)
  .check(validateInviteConfig)
  .check(validateWeatherKitConfig)
  .check(validateCacheConfig)
  .check(validateJwtLifetimes);

export type EnvConfig = AppConfig &
  CacheEnvConfig &
  DatabaseConfig &
  EmailConfig &
  JwtConfig &
  JobConfig &
  NudgeConfig &
  OAuthConfig &
  SecurityConfig &
  PushConfig &
  RetentionConfig &
  ExternalConfig &
  AiConfig &
  AiSuggestionConfig &
  WebhookConfig &
  FeatureDiscoveryConfig &
  InviteConfig;

/** 시작 검증. 스키마 위에 운영에서 위험한 조합을 거부하는 규칙을 더한다. */
const startupEnvSchema = envSchema.check(validateProductionReadiness);

// 오류는 키 이름과 규칙만 모아 한 번에 알리고 값은 싣지 않는다
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = startupEnvSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}
