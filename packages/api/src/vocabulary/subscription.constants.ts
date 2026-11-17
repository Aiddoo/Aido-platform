/** 사용자 구독 projection 상태 (FREE: 무료, ACTIVE: 구독 중, EXPIRED: 만료, CANCELLED: 취소) */
export const SUBSCRIPTION_STATUS = ["FREE", "ACTIVE", "EXPIRED", "CANCELLED"] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

/**
 * RevenueCat 이벤트의 결제 환경. SANDBOX는 TestFlight·App Review·개발 빌드의 테스트 결제다.
 * 서버는 SANDBOX 구매에도 프리미엄을 준다(심사 중 결제 확인). 매출 집계에서만 뺀다.
 */
export const SUBSCRIPTION_ENVIRONMENTS = ["SANDBOX", "PRODUCTION"] as const;

export type SubscriptionEnvironment = (typeof SUBSCRIPTION_ENVIRONMENTS)[number];

/** 보상 기간의 지급 출처. 값을 더하면 지급 경로마다 sourceKey 규칙을 함께 정한다. */
export const PREMIUM_GRANT_SOURCES = ["INVITE"] as const;

export type PremiumGrantSource = (typeof PREMIUM_GRANT_SOURCES)[number];

/** 보상 기간의 상태. BANKED는 쌓아 둔 기간, ACTIVE는 진행 중, ENDED는 끝남, REVOKED는 취소다. */
export const PREMIUM_GRANT_STATUSES = ["BANKED", "ACTIVE", "ENDED", "REVOKED"] as const;

export type PremiumGrantStatus = (typeof PREMIUM_GRANT_STATUSES)[number];

/** 프리미엄의 출처. STORE는 스토어 구독, GRANT는 서버가 지급한 보상 기간이다. */
export const PREMIUM_SOURCE = {
  STORE: "STORE",
  GRANT: "GRANT",
} as const;

export type PremiumSource = (typeof PREMIUM_SOURCE)[keyof typeof PREMIUM_SOURCE];

/**
 * RevenueCat period_type. 체험 전용 이벤트는 없고 이 값과 이벤트 종류로 체험을 판단한다.
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const STORE_PERIOD_TYPES = ["TRIAL", "INTRO", "NORMAL", "PROMOTIONAL", "PREPAID"] as const;

export type StorePeriodType = (typeof STORE_PERIOD_TYPES)[number];

/** 요금제 종류. 스토어 상품 ID로 정하고, 모르는 상품이면 서버가 null로 보낸다. */
export const SUBSCRIPTION_PLAN_TYPES = ["ANNUAL", "MONTHLY"] as const;

export type SubscriptionPlanType = (typeof SUBSCRIPTION_PLAN_TYPES)[number];

/** 무료 체험이 끝나기 며칠 전에 한 번 알릴지. 체험이 이보다 짧게 남은 채 시작했으면 알리지 않는다. */
export const PREMIUM_TRIAL_ENDING_NOTICE_DAYS = 3;

/** 보상 기간이 끝나기 며칠 전에 안내할지. 서버 PREMIUM_GRANT_ENDING 푸시와 앱 안내가 같은 값을 쓴다. */
export const PREMIUM_GRANT_ENDING_NOTICE_DAYS = 1;

/** 프리미엄이 아닌 사용자에게 보상 기간이 끝났다고 알려 줄 기간(일). 지나면 /me의 premiumGrantEndedAt이 null이다. */
export const PREMIUM_GRANT_ENDED_WINDOW_DAYS = 7;

/** 연간 구독이 자동 갱신되기 며칠 전에 한 번 알릴지. 월간은 매달 알리면 피로해서 알리지 않는다. */
export const PREMIUM_RENEWAL_NOTICE_DAYS = 7;
