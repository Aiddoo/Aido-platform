/**
 * 계정 provider(AccountProvider 값과 동일한 문자열) → 일일 가입 요약 표시 라벨.
 * 미매핑 값은 원문을 그대로 반환한다.
 */
const ACCOUNT_PROVIDER_LABELS: Record<string, string> = {
  CREDENTIAL: "이메일",
  APPLE: "Apple",
  GOOGLE: "Google",
  KAKAO: "Kakao",
  NAVER: "Naver",
};

export function accountProviderLabel(provider: string): string {
  return ACCOUNT_PROVIDER_LABELS[provider] ?? provider;
}
