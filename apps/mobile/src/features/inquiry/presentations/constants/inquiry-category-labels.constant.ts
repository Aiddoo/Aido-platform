import type { InquiryCategory } from '@aido/validators';

export const INQUIRY_CATEGORY_LABEL_KEYS = {
  BUG_REPORT: 'inquiry:category.bugReport',
  FEATURE_REQUEST: 'inquiry:category.featureRequest',
  OTHER: 'inquiry:category.other',
} as const satisfies Record<InquiryCategory, string>;
