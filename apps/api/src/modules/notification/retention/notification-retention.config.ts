import { defineConfig } from "#api/platform/config/define-config";
import { retentionSchema } from "#api/platform/config/schemas/retention.schema";

/** 신규 가입자 리텐션 실험(onboarding v2) 켜기와 실험군 비율. */
export const notificationRetentionConfig = defineConfig(
  "notificationRetention",
  retentionSchema.transform((env) => ({
    onboardingV2: {
      enabled: env.RETENTION_ONBOARDING_V2_ENABLED,
      treatmentPercent: env.RETENTION_ONBOARDING_V2_TREATMENT_PERCENT,
    },
  })),
  (env) => ({
    RETENTION_ONBOARDING_V2_ENABLED: env.RETENTION_ONBOARDING_V2_ENABLED,
    RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: env.RETENTION_ONBOARDING_V2_TREATMENT_PERCENT,
  }),
);
