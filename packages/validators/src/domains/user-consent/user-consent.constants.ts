/**
 * User Consent Constants
 *
 * 사용자 약관 동의 관련 상수
 */

/** 현재 약관 버전 */
export const TERMS_VERSION = {
  /** 현재 서비스 이용약관 버전 */
  CURRENT: '1.0.0',
} as const;

/** 동의 타입 */
export const CONSENT_TYPE = {
  /** 서비스 이용약관 */
  TERMS: 'TERMS',
  /** 개인정보처리방침 */
  PRIVACY: 'PRIVACY',
  /** 마케팅 수신 동의 */
  MARKETING: 'MARKETING',
} as const;

export type ConsentType = (typeof CONSENT_TYPE)[keyof typeof CONSENT_TYPE];
