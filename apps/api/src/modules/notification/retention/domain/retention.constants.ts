export const RETENTION_EXPERIMENT_KEY = "onboarding_v2_d7";
/** 카피 성과만 분리하며 기존 실험 배정과 처리 이력은 유지한다. */
export const RETENTION_CAMPAIGN_KEY = "onboarding_copy_v4";
export const RETENTION_STAGE_NAMES = ["D0", "D1", "D3", "D7"] as const;
export const RETENTION_VARIANTS = ["CONTROL", "TREATMENT"] as const;
export const RETENTION_STAGE_STATUSES = ["SCHEDULED", "SKIPPED", "OUTBOXED", "EVALUATED"] as const;

export type RetentionStageName = (typeof RETENTION_STAGE_NAMES)[number];
export type RetentionVariant = (typeof RETENTION_VARIANTS)[number];
