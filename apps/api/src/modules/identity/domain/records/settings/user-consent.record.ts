/**
 * 약관 동의 레코드(리포지토리 읽기 모델). Prisma UserConsent와 구조적 호환.
 */
export interface UserConsentRecord {
  termsAgreedAt: Date | null;
  privacyAgreedAt: Date | null;
  agreedTermsVersion: string | null;
  marketingAgreedAt: Date | null;
  marketingPushAgreedAt: Date | null;
  /** 현재 aiDataSharingVersion 안내에 동의한 시각. 거부·철회했으면 null */
  aiDataSharingAgreedAt: Date | null;
  /** 마지막으로 답한 AI 데이터 처리 안내 버전. 답한 적 없으면 null */
  aiDataSharingVersion: string | null;
}
