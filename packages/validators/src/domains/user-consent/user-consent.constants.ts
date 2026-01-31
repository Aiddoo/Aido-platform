export const TERMS_VERSION = {
  CURRENT: '1.0.0',
} as const;

export const CONSENT_TYPE = {
  TERMS: 'TERMS',
  PRIVACY: 'PRIVACY',
  MARKETING: 'MARKETING',
} as const;

export type ConsentType = (typeof CONSENT_TYPE)[keyof typeof CONSENT_TYPE];
