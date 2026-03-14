import type { InquiryCategory } from '@aido/validators';

export const INQUIRY_CATEGORY_LABELS = {
  BUG_REPORT: '버그 신고',
  FEATURE_REQUEST: '기능 요청',
  OTHER: '기타',
} as const satisfies Record<InquiryCategory, string>;
