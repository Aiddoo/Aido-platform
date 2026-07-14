export const RETENTION_EXPERIMENT_KEY = "onboarding_v2_d7";
export const RETENTION_CAMPAIGN_KEY = "onboarding_v2_d7";
export const RETENTION_STAGE_NAMES = ["D0", "D1", "D3", "D7"] as const;

export type RetentionStageName = (typeof RETENTION_STAGE_NAMES)[number];
export type RetentionVariant = "CONTROL" | "TREATMENT";
