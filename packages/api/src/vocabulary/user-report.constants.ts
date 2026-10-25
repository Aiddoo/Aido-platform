export const USER_REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "INAPPROPRIATE",
  "IMPERSONATION",
  "OTHER",
] as const;

export type UserReportReason = (typeof USER_REPORT_REASONS)[number];

/** 신고할 수 있는 사용자 콘텐츠. PROFILE만 개별 콘텐츠 ID 없이 사용자 자체를 가리킨다. */
export const USER_REPORT_TARGET_TYPES = [
  "PROFILE",
  "TODO",
  "COMMENT",
  "NUDGE_MESSAGE",
  "CHEER_MESSAGE",
] as const;

export type UserReportTargetType = (typeof USER_REPORT_TARGET_TYPES)[number];

export const USER_REPORT_STATUSES = ["OPEN", "RESOLVED"] as const;

export type UserReportStatus = (typeof USER_REPORT_STATUSES)[number];

export const USER_REPORT_LIMITS = {
  MAX_DETAIL_LENGTH: 500,
  MAX_TARGET_ID_LENGTH: 64,
  /** 같은 신고자가 같은 대상을 다시 신고해도 새 접수로 보지 않는 기간 */
  DUPLICATE_WINDOW_HOURS: 24,
  /** 한 사용자가 24시간 동안 접수할 수 있는 신고 수 */
  DAILY_LIMIT: 20,
} as const;
