import type {
  DeviceType,
  PremiumSource,
  StorePeriodType,
  SubscriptionEnvironment,
  SubscriptionPlanType,
} from "@aido/api/vocabulary";

import type { AdminNotification } from "./admin-notification.read-model.js";

/** 가입 방식. 계정 공급자(AccountProvider)와 같은 값이다. */
export const SIGNUP_METHOD = {
  CREDENTIAL: "CREDENTIAL",
  APPLE: "APPLE",
  GOOGLE: "GOOGLE",
  KAKAO: "KAKAO",
  NAVER: "NAVER",
} as const;

export type SignupMethod = (typeof SIGNUP_METHOD)[keyof typeof SIGNUP_METHOD];

/**
 * 가입·결제 알림이 함께 쓰는 사용자 블록. 같은 조회로 채워 두 알림의 사용자 칸이 같은 값·같은 순서다.
 * 조회하지 못한 값은 비운다.
 */
export interface AdminNoticeUser {
  readonly userId: string;
  readonly email: string;
  readonly nickname?: string;
  readonly userTag?: string;
  /** 가입 시각(ISO string) */
  readonly joinedAt?: string;
  readonly signupMethod?: SignupMethod;
}

/** 결제 채널에 알릴 구독 이벤트. 공급자 이벤트 이름이 아니라 운영자가 구분할 일의 이름이다. */
export const SUBSCRIPTION_NOTICE_EVENT = {
  PURCHASED: "purchased",
  ONE_TIME_PURCHASED: "one_time_purchased",
  TRIAL_STARTED: "trial_started",
  TRIAL_CONVERTED: "trial_converted",
  RENEWED: "renewed",
  CANCELLATION_SCHEDULED: "cancellation_scheduled",
  TRIAL_CANCELLED: "trial_cancelled",
  UNCANCELLED: "uncancelled",
  EXPIRED: "expired",
  TRIAL_EXPIRED: "trial_expired",
  BILLING_ISSUE: "billing_issue",
  REFUNDED: "refunded",
  PRODUCT_CHANGE_SCHEDULED: "product_change_scheduled",
  TRANSFERRED: "transferred",
  EXTENDED: "extended",
} as const;

export type SubscriptionNoticeEvent =
  (typeof SUBSCRIPTION_NOTICE_EVENT)[keyof typeof SUBSCRIPTION_NOTICE_EVENT];

/** 큐 payload 검증에 쓰는 결제 어휘. billing 값이 늘면 구독 알림 입력을 넘기는 호출 쪽 컴파일이 가리킨다. */
export const NOTICE_STORE = {
  APP_STORE: "APP_STORE",
  MAC_APP_STORE: "MAC_APP_STORE",
  PLAY_STORE: "PLAY_STORE",
  STRIPE: "STRIPE",
  WEB_BILLING: "WEB_BILLING",
  AMAZON: "AMAZON",
  PROMOTIONAL: "PROMOTIONAL",
} as const;

export type NoticeStore = (typeof NOTICE_STORE)[keyof typeof NOTICE_STORE];

export const NOTICE_END_REASON = {
  UNSUBSCRIBE: "UNSUBSCRIBE",
  BILLING_ERROR: "BILLING_ERROR",
  DEVELOPER_INITIATED: "DEVELOPER_INITIATED",
  PRICE_INCREASE: "PRICE_INCREASE",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
  SUBSCRIPTION_PAUSED: "SUBSCRIPTION_PAUSED",
  UNKNOWN: "UNKNOWN",
} as const;

export type NoticeEndReason = (typeof NOTICE_END_REASON)[keyof typeof NOTICE_END_REASON];

export interface SubscriptionNoticePrice {
  /** 사용자가 낸 통화의 금액 */
  readonly amount?: number;
  readonly currency?: string;
  /** 공급자가 USD로 환산한 금액 */
  readonly usd?: number;
}

export interface SubscriptionNoticePremium {
  readonly source: PremiumSource | null;
  /** 지금 출처 기간의 끝(ISO string) */
  readonly periodEndsAt?: string;
  /** 지금 기간 뒤에 이어질 쌓아 둔 보상 일수 */
  readonly bankedDays: number;
  readonly isTrial: boolean;
}

/** 결제 블록. 공급자 웹훅이 준 값을 그대로 옮기고 표시 형식은 채널 어댑터가 정한다. */
export interface SubscriptionNotice {
  readonly event: SubscriptionNoticeEvent;
  readonly environment?: SubscriptionEnvironment;
  readonly store?: NoticeStore;
  readonly productId?: string;
  readonly planType?: SubscriptionPlanType;
  readonly newProductId?: string;
  readonly newPlanType?: SubscriptionPlanType;
  readonly periodKind?: StorePeriodType;
  readonly price: SubscriptionNoticePrice;
  readonly purchasedAt?: string;
  /** 지금 기간의 끝. 자동 갱신 중이면 다음 갱신, 해지했으면 이용 종료다. */
  readonly expiresAt?: string;
  readonly gracePeriodEndsAt?: string;
  readonly endReason?: NoticeEndReason;
  readonly countryCode?: string;
  readonly isFirstPurchase?: boolean;
  readonly premium?: SubscriptionNoticePremium;
  readonly transfer?: { readonly from: readonly string[]; readonly to: readonly string[] };
  readonly storeSubscriptionId?: string;
  readonly appVersion?: string;
  readonly deviceModel?: string;
  /** 공급자 고객 화면 주소 */
  readonly customerUrl?: string;
}

/** 가입 요청에서 확인한 기기·앱 정보 */
export interface SignupNotice {
  readonly devicePlatform?: DeviceType;
  readonly deviceModel?: string;
  readonly osVersion?: string;
  readonly appVersion?: string;
  readonly appBuild?: string;
  readonly locale?: string;
  readonly timezone?: string;
}

/**
 * 관리자 채널로 보낼 알림. 채널에 상관없는 사실만 담고 제목·이모지·색·필드 배치·날짜 표시는 채널 어댑터가
 * 렌더링한다. `message`는 이미 조립한 일반 알림(일일 요약·이전 형식 잡)이다.
 */
export type AdminNotice =
  | { readonly type: "message"; readonly message: AdminNotification }
  | {
      readonly type: "user_registered";
      readonly user: AdminNoticeUser;
      readonly signup: SignupNotice;
    }
  | {
      readonly type: "subscription_event";
      readonly user: AdminNoticeUser;
      readonly subscription: SubscriptionNotice;
    };
