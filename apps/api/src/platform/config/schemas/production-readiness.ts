import type { z } from "zod";

import { type AppConfig, type AppEnvironment, resolveAppEnvironment } from "./app.schema.js";
import { defaultEmailProvider, type EmailConfig } from "./email.schema.js";
import type { ExternalConfig } from "./external.schema.js";
import { hasOAuthProvider, type OAuthConfig } from "./oauth.schema.js";
import { defaultAdminNotifierProvider, type WebhookConfig } from "./webhook.schema.js";

type ProductionReadinessInput = AppConfig &
  EmailConfig &
  ExternalConfig &
  OAuthConfig &
  WebhookConfig;

const isBlank = (value: string | undefined): boolean => value == null || value.trim() === "";

/**
 * 운영(APP_ENV=production, 없으면 NODE_ENV=production)에서 위험한 설정 조합이면 시작을 거부한다.
 * 메시지는 키 이름과 규칙만 적고 값은 싣지 않는다. 개발 도구는 배포 환경에서 유도해 운영에서 켤 설정이 없다.
 */
export function validateProductionReadiness({
  value: env,
  issues,
}: z.core.ParsePayload<ProductionReadinessInput>): void {
  const environment = resolveAppEnvironment(env);
  if (environment !== "production") {
    return;
  }
  const refuse = (key: string, message: string) => {
    issues.push({ code: "custom", input: undefined, path: [key], message });
  };

  const emailProvider =
    env.EMAIL_PROVIDER ?? defaultEmailProvider(environment, env.RESEND_API_KEY ?? null);
  if (emailProvider !== "resend") {
    refuse("EMAIL_PROVIDER", "must be resend in production (log does not deliver email)");
  }
  if (isBlank(env.RESEND_API_KEY)) {
    refuse("RESEND_API_KEY", "is required in production");
  }

  const hasDiscordWebhook =
    !isBlank(env.DISCORD_SIGNUP_WEBHOOK_URL) || !isBlank(env.DISCORD_PAYMENT_WEBHOOK_URL);
  const adminNotifierProvider =
    env.ADMIN_NOTIFIER_PROVIDER ?? defaultAdminNotifierProvider(environment, hasDiscordWebhook);
  if (adminNotifierProvider !== "discord") {
    refuse(
      "ADMIN_NOTIFIER_PROVIDER",
      "must be discord in production (log does not notify operators)",
    );
  }

  if (isBlank(env.REVENUECAT_WEBHOOK_SECRET)) {
    refuse(
      "REVENUECAT_WEBHOOK_SECRET",
      "is required in production to verify RevenueCat webhook signatures",
    );
  }

  if (!hasOAuthProvider(env)) {
    refuse(
      "OAUTH",
      "production requires at least one OAuth provider (GOOGLE_*, APPLE_*, KAKAO_* or NAVER_*)",
    );
  }
}

/** 운영에서 비어 있으면 시작은 하되 경고를 남기는 키. */
export function productionConfigWarnings(input: {
  readonly environment: AppEnvironment;
  readonly sentryDsn: string | undefined;
}): string[] {
  if (input.environment !== "production") {
    return [];
  }
  return isBlank(input.sentryDsn) ? ["SENTRY_DSN"] : [];
}
