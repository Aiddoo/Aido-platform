import type { UserRegisteredEventPayload } from "../../types/notifications/user-registered.payload.js";

/** 회원가입 방식 (소셜/자격증명) */
export type Provider = UserRegisteredEventPayload["provider"];

/** 가입 방식 → 표시 라벨 */
export const PROVIDER_LABELS: Record<Provider, string> = {
  credential: "이메일",
  apple: "Apple",
  google: "Google",
  kakao: "Kakao",
  naver: "Naver",
};

/** 확인된 기기 플랫폼 → 표시 라벨 */
export const DEVICE_PLATFORM_LABELS: Record<
  NonNullable<UserRegisteredEventPayload["devicePlatform"]>,
  string
> = {
  IOS: "🍎 iOS",
  ANDROID: "🤖 Android",
  WEB: "🌐 Web",
};

/**
 * 계정 provider(Prisma AccountProvider 값과 동일한 문자열) → 표시 라벨.
 *
 * 계정 공급자 사실을 관리자 채널 표시 라벨로 바꾸고,
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
