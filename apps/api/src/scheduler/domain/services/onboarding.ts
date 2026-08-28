/**
 * 온보딩 알림 발송 정책 (순수 도메인).
 *
 * 가입 후 경과일이 지정 day에 해당할 때만 온보딩 알림을 발송한다.
 */

/** 온보딩 알림 발송 대상 day (가입 후 경과일) */
export const ONBOARDING_DAYS = [0, 1, 2, 3, 5, 7] as const;
export type OnboardingDay = (typeof ONBOARDING_DAYS)[number];
export type OnboardingDayRequiringCompletedCount = Extract<OnboardingDay, 5 | 7>;

/** 온보딩 최대 경과일 (DB 조회 범위 제한용) */
export const ONBOARDING_MAX_DAY = 7;

const ONBOARDING_DAY_SET = new Set<number>(ONBOARDING_DAYS);

/** 경과일이 온보딩 발송 대상 day인지 판정 */
export function isOnboardingDay(day: number): day is OnboardingDay {
	return ONBOARDING_DAY_SET.has(day);
}

/** 해당 day가 완료 수 조회 대상인지 판정 */
export function requiresCompletedCount(
	day: OnboardingDay,
): day is OnboardingDayRequiringCompletedCount {
	return day === 5 || day === 7;
}
