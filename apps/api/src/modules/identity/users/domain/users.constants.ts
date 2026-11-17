import type { USER_STATUS } from "@aido/api/vocabulary";

export type UserStatus = (typeof USER_STATUS)[number];

export const SECURITY_LOG_RETENTION_DAYS = 365;
