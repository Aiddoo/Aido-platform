import type { UserRegisteredEventPayload } from "../types/user-registered.payload";

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

/**
 * 가입 방식 → 기기 추정 라벨 (Apple/Google만 추정 가능)
 */
export const PROVIDER_DEVICE_LABELS: Partial<Record<Provider, string>> = {
	apple: "🍎 iOS (추정)",
	google: "🤖 Android (추정)",
};

/**
 * 계정 provider(Prisma AccountProvider 값과 동일한 문자열) → 표시 라벨.
 *
 * 도메인은 Prisma enum에 의존하지 않으므로 문자열 키 맵으로 정의하고,
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
