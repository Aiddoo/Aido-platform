/**
 * 구독 이벤트 페이로드 정의
 *
 * RevenueCat 웹훅으로부터 수신되는 구독 관련 이벤트 페이로드.
 * SubscriptionService 및 AdminEventNotifier에서 사용됩니다.
 */

import type {
  RevenueCatEventType,
  RevenueCatStore,
  SubscriptionEnvironment,
} from "@aido/api/vocabulary";

import type { SubscriptionLifecycle } from "../../../domain/policies/subscriptions/subscription-lifecycle.policy.js";

export type { SubscriptionLifecycle };

/**
 * 구독 이벤트 페이로드
 */
export interface SubscriptionEventPayload {
  /** 사용자 ID */
  userId: string;
  /** 이메일 */
  email: string;
  /** 이벤트 타입 (RevenueCat 원본 이벤트명) */
  eventType: RevenueCatEventType;
  /** 상품 ID */
  productId: string;
  /** 스토어 (APP_STORE / PLAY_STORE / STRIPE 등) */
  store?: RevenueCatStore;
  /** 결제 환경. SANDBOX는 테스트 결제라 관리자 알림에 표시하고 매출로 보지 않는다. */
  environment?: SubscriptionEnvironment;
  /** 트랜잭션 ID */
  transactionId?: string;
  /** 구매 시각 (ISO string) */
  purchasedAt?: string;
  /** 만료 시각 (ISO string) */
  expiresAt?: string;
  /** 취소 사유 */
  cancelReason?: string;
  /** 사용자 이름 (UserProfile.name) */
  name?: string;
  /** USD 기준 가격 (RevenueCat event.price — 항상 USD) */
  priceUsd?: number;
  /** 구매 통화 기준 가격 (RevenueCat event.price_in_purchased_currency) */
  priceInPurchasedCurrency?: number;
  /** 구매 통화 코드 (RevenueCat event.currency, e.g. KRW) */
  purchasedCurrency?: string;
  /** RevenueCat app_user_id. 운영 알림의 고객 링크에 쓴다. */
  appUserId?: string;
  /** RevenueCat 고객 화면 주소. REVENUECAT_PROJECT_ID가 있을 때만 알림 어댑터가 채운다. */
  revenueCatCustomerUrl?: string;
  /** RevenueCat 이벤트 ID. 알림 잡 멱등 키로 쓴다. */
  eventId?: string;
  /** 구매 국가 (event.country_code) */
  countryCode?: string;
  /** 구독 유형 (event.period_type: NORMAL / TRIAL / INTRO / PROMOTIONAL / PREPAID) */
  periodType?: string;
  /** 만료 사유 (event.expiration_reason) */
  expirationReason?: string;
  /** 앱이 RevenueCat subscriber attribute(appVersion)로 남긴 앱 버전 */
  appVersion?: string;
  /** 앱이 RevenueCat subscriber attribute(deviceModel)로 남긴 기기 모델 */
  deviceModel?: string;
  /** 무료 체험 단계(시작·해지·전환·종료). 체험과 관계없는 이벤트는 비운다. */
  lifecycle?: SubscriptionLifecycle;
  /** 이 사용자의 첫 스토어 구매인지(구매 이벤트만) */
  isFirstPurchase?: boolean;
  /** 이 이벤트로 다시 계산한 보상 기간 상태. 쌓아 둔 보상이 있거나 보상 기간이 이어질 때만 있다. */
  premiumGrantImpact?: PremiumGrantImpact;
}

export interface PremiumGrantImpact {
  /** 스토어 구독 뒤로 쌓아 둔 보상 일수 */
  readonly bankedDays: number;
  /** 스토어가 끝나 보상 기간이 이어졌으면 그 기간의 끝(ISO string). 아니면 null이다. */
  readonly grantPeriodEndsAt: string | null;
}
