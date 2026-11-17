export const INQUIRY_CATEGORY = {
  BUG_REPORT: "BUG_REPORT",
  FEATURE_REQUEST: "FEATURE_REQUEST",
  PAYMENT: "PAYMENT",
  OTHER: "OTHER",
} as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORY)[keyof typeof INQUIRY_CATEGORY];

export const INQUIRY_CONTENT_LIMITS = {
  MIN_LENGTH: 10,
  MAX_LENGTH: 2000,
} as const;

/** 문의·신고를 받는 주소. 앱의 메일 문의와 서버 SUPPORT_EMAIL 기본값이 같은 주소다. */
export const SUPPORT_EMAIL_ADDRESS = "support@aido.kr";
