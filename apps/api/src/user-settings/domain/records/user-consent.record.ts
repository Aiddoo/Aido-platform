/**
 * 약관 동의 레코드(리포지토리 읽기 모델). Prisma UserConsent와 구조적 호환.
 */
export interface UserConsentRecord {
	termsAgreedAt: Date | null;
	privacyAgreedAt: Date | null;
	agreedTermsVersion: string | null;
	marketingAgreedAt: Date | null;
	marketingPushAgreedAt: Date | null;
}
