/**
 * 약관 동의 레코드(리포지토리 읽기 모델). DB UserConsent 행과 구조적으로 호환된다.
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
  /** 광고성 수신 동의 사실을 2년마다 다시 알린 마지막 시각. 알린 적 없으면 null */
  marketingReconfirmedAt: Date | null;
}
