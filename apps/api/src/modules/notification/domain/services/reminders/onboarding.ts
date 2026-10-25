import { NOTICE_DEEP_LINK_PATH, type NoticeDeepLinkPath } from "@aido/api/vocabulary";

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

/**
 * 온보딩 알림을 탭하면 열 앱 화면. 문구가 권하는 화면을 고른다.
 * 친구(Day 2)·알림 설정(Day 3)·완료 기록(Day 5 완료 1개 이상·Day 7) 외에는 할 일을 적는 피드다.
 * Day 3은 시간을 바로 고르는 리마인더 화면이 프리미엄 전용이라, 누구나 쓰는 알림 설정 첫 화면을 연다.
 */
export function resolveOnboardingDeepLinkPath(
  day: OnboardingDay,
  completedCount: number,
): NoticeDeepLinkPath {
  if (day === 2) {
    return NOTICE_DEEP_LINK_PATH.FRIENDS;
  }
  if (day === 3) {
    return NOTICE_DEEP_LINK_PATH.NOTIFICATION_SETTINGS;
  }
  if (day === 7 || (day === 5 && completedCount > 0)) {
    return NOTICE_DEEP_LINK_PATH.ACHIEVEMENTS;
  }
  return NOTICE_DEEP_LINK_PATH.FEED;
}
