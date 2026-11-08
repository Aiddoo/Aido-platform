/** 사용자 구독 projection 상태 (FREE: 무료, ACTIVE: 구독 중, EXPIRED: 만료, CANCELLED: 취소) */
export const SUBSCRIPTION_STATUS = ["FREE", "ACTIVE", "EXPIRED", "CANCELLED"] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

/**
 * 알려진 RevenueCat 이벤트 타입 (코드 참조 및 switch문용)
 *
 * RevenueCat은 새 이벤트 타입을 추가할 수 있으므로,
 * Zod 스키마에서는 z.string()으로 수용하고 여기서는 참조용으로만 사용합니다.
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const REVENUECAT_EVENT_TYPES = [
  "TEST",
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "CANCELLATION",
  "UNCANCELLATION",
  "BILLING_ISSUE",
  "SUBSCRIBER_ALIAS",
  "SUBSCRIPTION_PAUSED",
  "SUBSCRIPTION_EXTENDED",
  "TRANSFER",
  "EXPIRATION",
  "TEMPORARY_ENTITLEMENT_GRANT",
] as const;

/** 알려진 이벤트 타입 유니온 (switch문 참조용). 실제 webhook은 이 외의 타입도 수신 가능. */
export type RevenueCatEventType = (typeof REVENUECAT_EVENT_TYPES)[number] | (string & {});

/**
 * 알려진 RevenueCat 스토어 (코드 참조용)
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const REVENUECAT_STORES = [
  "APP_STORE",
  "MAC_APP_STORE",
  "PLAY_STORE",
  "AMAZON",
  "STRIPE",
  "RC_BILLING",
  "PROMOTIONAL",
] as const;

/** 알려진 스토어 유니온 (참조용). 실제 webhook은 이 외의 스토어도 수신 가능. */
export type RevenueCatStore = (typeof REVENUECAT_STORES)[number] | (string & {});

/**
 * RevenueCat 이벤트의 결제 환경. SANDBOX는 TestFlight·App Review·개발 빌드의 테스트 결제다.
 * 서버는 SANDBOX 구매에도 프리미엄을 준다(심사 중 결제 확인). 매출 집계에서만 뺀다.
 */
export const SUBSCRIPTION_ENVIRONMENTS = ["SANDBOX", "PRODUCTION"] as const;

export type SubscriptionEnvironment = (typeof SUBSCRIPTION_ENVIRONMENTS)[number];

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

/** STORE_PERIOD_TYPES의 값을 이름으로 가리킨다. */
export const STORE_PERIOD_TYPE = {
  TRIAL: "TRIAL",
  INTRO: "INTRO",
  NORMAL: "NORMAL",
  PROMOTIONAL: "PROMOTIONAL",
  PREPAID: "PREPAID",
} as const satisfies Record<StorePeriodType, StorePeriodType>;

/** 무료 체험이 끝나기 며칠 전에 한 번 알릴지. 체험이 이보다 짧게 남은 채 시작했으면 알리지 않는다. */
export const PREMIUM_TRIAL_ENDING_NOTICE_DAYS = 3;

/** 보상 기간이 끝나기 며칠 전에 안내할지. 서버 PREMIUM_GRANT_ENDING 푸시와 앱 안내가 같은 값을 쓴다. */
export const PREMIUM_GRANT_ENDING_NOTICE_DAYS = 1;

/** 프리미엄이 아닌 사용자에게 보상 기간이 끝났다고 알려 줄 기간(일). 지나면 /me의 premiumGrantEndedAt이 null이다. */
export const PREMIUM_GRANT_ENDED_WINDOW_DAYS = 7;
