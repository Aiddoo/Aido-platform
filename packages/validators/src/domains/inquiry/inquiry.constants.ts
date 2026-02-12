export const INQUIRY_CATEGORY = {
  BUG_REPORT: 'BUG_REPORT',
  FEATURE_REQUEST: 'FEATURE_REQUEST',
  OTHER: 'OTHER',
} as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORY)[keyof typeof INQUIRY_CATEGORY];

export const INQUIRY_CONTENT_LIMITS = {
  MIN_LENGTH: 10,
  MAX_LENGTH: 2000,
} as const;
