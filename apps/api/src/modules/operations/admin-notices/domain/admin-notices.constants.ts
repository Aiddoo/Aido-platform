import type { ACCOUNT_PROVIDERS } from "@aido/api/vocabulary";

/** 관리자 알림을 보내는 채널. admin은 가입·운영 알림, payment는 결제 알림이다. */
export const ADMIN_NOTIFICATION_CHANNELS = ["admin", "payment"] as const;

export type AdminNotificationChannel = (typeof ADMIN_NOTIFICATION_CHANNELS)[number];

export const ADMIN_NOTIFICATION_SEVERITIES = ["info", "success", "warning", "critical"] as const;

export type AdminNotificationSeverity = (typeof ADMIN_NOTIFICATION_SEVERITIES)[number];

/** 가입 이벤트가 싣는 로그인 방식. identity의 계정 공급자(대문자)를 소문자로 옮긴 값이다. */
const SIGNUP_EVENT_PROVIDERS = ["credential", "apple", "google", "kakao", "naver"] as const;

export type SignupEventProvider = (typeof SIGNUP_EVENT_PROVIDERS)[number];

/** 가입 방식. 처음 만든 인증 계정의 공급자 값 그대로다. */
export type SignupMethod = (typeof ACCOUNT_PROVIDERS)[number];

/** 결제 채널에 알릴 구독 이벤트. 공급자 이벤트 이름이 아니라 운영자가 구분할 일의 이름이다. */
export const SUBSCRIPTION_NOTICE_EVENTS = [
  "purchased",
  "one_time_purchased",
  "trial_started",
  "trial_converted",
  "renewed",
  "cancellation_scheduled",
  "trial_cancelled",
  "uncancelled",
  "expired",
  "trial_expired",
  "billing_issue",
  "refunded",
  "product_change_scheduled",
  "transferred",
  "extended",
] as const;

export type SubscriptionNoticeEvent = (typeof SUBSCRIPTION_NOTICE_EVENTS)[number];

// 큐 payload 검증에 쓰는 결제 어휘다. billing 값이 늘면 구독 알림 입력을 넘기는 호출 쪽 컴파일이 가리킨다
export const NOTICE_STORES = [
  "APP_STORE",
  "MAC_APP_STORE",
  "PLAY_STORE",
  "STRIPE",
  "WEB_BILLING",
  "AMAZON",
  "PROMOTIONAL",
] as const;

export type NoticeStore = (typeof NOTICE_STORES)[number];

export const NOTICE_END_REASONS = [
  "UNSUBSCRIBE",
  "BILLING_ERROR",
  "DEVELOPER_INITIATED",
  "PRICE_INCREASE",
  "CUSTOMER_SUPPORT",
  "SUBSCRIPTION_PAUSED",
  "UNKNOWN",
] as const;

export type NoticeEndReason = (typeof NOTICE_END_REASONS)[number];

// 관리자 알림이 구독 이벤트에서 읽는 값이다. billing이 같은 모양으로 넘기고, billing의 값이 늘면 호출 쪽 컴파일이 가리킨다
const SUBSCRIPTION_ALERT_KINDS = [
  "STARTED",
  "RENEWED",
  "CANCELLED",
  "UNCANCELLED",
  "EXPIRED",
  "REFUNDED",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE_SCHEDULED",
  "EXTENDED",
  "TRANSFERRED",
] as const;

export type SubscriptionAlertKind = (typeof SUBSCRIPTION_ALERT_KINDS)[number];

const SUBSCRIPTION_ALERT_LIFECYCLES = [
  "trial_started",
  "trial_cancelled",
  "trial_converted",
  "trial_expired",
] as const;

export type SubscriptionAlertLifecycle = (typeof SUBSCRIPTION_ALERT_LIFECYCLES)[number];
