import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import {
  type AppEnvironment,
  appSchema,
  resolveAppEnvironment,
} from "#api/platform/config/schemas/app.schema";
import { externalSchema } from "#api/platform/config/schemas/external.schema";

/** RevenueCat 웹훅 Authorization 검사. 비밀이 있으면 항상 검증하고, 없으면 개발 환경만 건너뛴다. */
export type WebhookSignatureCheck =
  | { readonly mode: "verify"; readonly secret: string }
  | { readonly mode: "skip" }
  | { readonly mode: "reject" };

function resolveWebhookSignatureCheck(input: {
  readonly environment: AppEnvironment;
  readonly secret: string | undefined;
}): WebhookSignatureCheck {
  if (input.secret != null && input.secret !== "") {
    return { mode: "verify", secret: input.secret };
  }
  // 비밀 없는 스테이징·운영은 검증을 끄지 않고 모두 거절한다(운영은 시작 검증이 비밀을 요구한다)
  return input.environment === "development" ? { mode: "skip" } : { mode: "reject" };
}

/**
 * RevenueCat 웹훅 검사 방식·Test Store 구매 반영 여부와 REST v2 대조 설정. 프로젝트 ID와 읽기 키가 함께 있어야
 * 대조가 켜진다.
 */
export const billingSubscriptionsConfig = defineConfig(
  "billingSubscriptions",
  appSchema
    .pick({ NODE_ENV: true, APP_ENV: true })
    .extend(
      externalSchema.pick({
        REVENUECAT_WEBHOOK_SECRET: true,
        REVENUECAT_PROJECT_ID: true,
        REVENUECAT_API_V2_SECRET_KEY: true,
      }).shape,
    )
    .transform((env) => {
      const environment = resolveAppEnvironment(env);
      return {
        revenuecat: {
          projectId: env.REVENUECAT_PROJECT_ID,
          apiV2SecretKey: env.REVENUECAT_API_V2_SECRET_KEY,
        },
        webhookSignature: resolveWebhookSignatureCheck({
          environment,
          secret: env.REVENUECAT_WEBHOOK_SECRET,
        }),
        // 웹훅 연동이 하나라 Test Store 구매도 운영으로 온다. 운영은 결제 없는 구매에 프리미엄을 주지 않는다
        acceptsTestStorePurchases: environment !== "production",
      };
    }),
  (env) => ({
    NODE_ENV: env.NODE_ENV,
    APP_ENV: env.APP_ENV,
    REVENUECAT_WEBHOOK_SECRET: env.REVENUECAT_WEBHOOK_SECRET,
    REVENUECAT_PROJECT_ID: env.REVENUECAT_PROJECT_ID,
    REVENUECAT_API_V2_SECRET_KEY: env.REVENUECAT_API_V2_SECRET_KEY,
  }),
);

export type BillingSubscriptionsConfig = ConfigType<typeof billingSubscriptionsConfig>;
