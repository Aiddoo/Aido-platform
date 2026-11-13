import type { SignupMethod } from "../../domain/admin-notices.constants.js";

const ACCOUNT_PROVIDER_LABELS: Readonly<Record<string, string>> = {
  CREDENTIAL: "이메일",
  APPLE: "Apple",
  GOOGLE: "Google",
  KAKAO: "Kakao",
  NAVER: "Naver",
} satisfies Record<SignupMethod, string>;

// 일일 가입 요약은 DB 문자열을 받으므로 모르는 공급자는 원문 그대로 적는다
export function accountProviderLabel(provider: string): string {
  return ACCOUNT_PROVIDER_LABELS[provider] ?? provider;
}
