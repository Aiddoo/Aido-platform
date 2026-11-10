import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { externalSchema } from "#api/platform/config/schemas/external.schema";

/** RevenueCat 웹훅 비밀·프로젝트 ID·REST v2 읽기 키. 프로젝트 ID와 읽기 키가 함께 있어야 대조가 켜진다. */
export const billingSubscriptionsConfig = defineConfig(
  "billingSubscriptions",
  externalSchema
    .pick({
      REVENUECAT_WEBHOOK_SECRET: true,
      REVENUECAT_PROJECT_ID: true,
      REVENUECAT_API_V2_SECRET_KEY: true,
    })
    .transform((env) => ({
      revenuecat: {
        webhookSecret: env.REVENUECAT_WEBHOOK_SECRET,
        projectId: env.REVENUECAT_PROJECT_ID,
        apiV2SecretKey: env.REVENUECAT_API_V2_SECRET_KEY,
      },
    })),
  (env) => ({
    REVENUECAT_WEBHOOK_SECRET: env.REVENUECAT_WEBHOOK_SECRET,
    REVENUECAT_PROJECT_ID: env.REVENUECAT_PROJECT_ID,
    REVENUECAT_API_V2_SECRET_KEY: env.REVENUECAT_API_V2_SECRET_KEY,
  }),
);

export type BillingSubscriptionsConfig = ConfigType<typeof billingSubscriptionsConfig>;
