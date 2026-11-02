import type { SubscriptionEventPayload } from "#api/modules/billing/billing-subscriptions.public";

/**
 * 결제 채널 구독 알림 입력.
 *
 * billing의 구독 이벤트 페이로드에 RevenueCat 이벤트의 부가 정보가 실려 오면 함께 표시한다.
 * 모든 부가 필드는 선택이며 없으면 알림에서 "—"로 표시하거나 생략한다.
 */
export interface SubscriptionAlertInput extends SubscriptionEventPayload {
  /** RevenueCat 이벤트 ID (event.id). 알림 잡 멱등 키로 쓴다. */
  readonly eventId?: string;
  /** 구매 국가 (event.country_code, ISO 3166-1 alpha-2) */
  readonly countryCode?: string;
  /** 구독 유형 (event.period_type: NORMAL / TRIAL / INTRO / PROMOTIONAL / PREPAID) */
  readonly periodType?: string;
  /** 만료 사유 (event.expiration_reason) */
  readonly expirationReason?: string;
  /** 앱 버전 (subscriber attributes) */
  readonly appVersion?: string;
  /** 기기 모델 (subscriber attributes) */
  readonly deviceModel?: string;
}
