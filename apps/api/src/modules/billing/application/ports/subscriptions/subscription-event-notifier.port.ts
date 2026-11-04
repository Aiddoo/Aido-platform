import type { SubscriptionEventPayload } from "../../types/subscriptions/subscription-event.payload.js";

/** 실패를 보고할 웹훅 이벤트. TRANSFER는 구독자·상품 필드가 없다. */
export interface WebhookFailureContext {
  readonly eventType: string;
  readonly eventId?: string;
  readonly store?: string;
  readonly appUserId?: string;
  readonly productId?: string;
}

export const SUBSCRIPTION_EVENT_NOTIFIER = Symbol("SUBSCRIPTION_EVENT_NOTIFIER");

/**
 * 구독 이벤트 알림 포트.
 *
 * DB 반영 후(커밋 후) 관리자 알림 및 결제 이슈 푸시 알림 잡을 fire-and-forget으로
 * 등록한다. 어댑터가 admin-notification·notification 큐 서비스로 위임한다.
 * 웹훅 처리 실패 보고(에러 관측 + 운영 경보)도 벤더(Sentry) 추상화로 노출한다.
 */
export interface SubscriptionEventNotifierPort {
  notifySubscriptionEvent(payload: SubscriptionEventPayload): void;
  notifyBillingIssue(userId: string): void;

  /**
   * 웹훅 처리 실패를 보고한다 (fire-and-forget).
   * 에러 관측(Sentry 태깅 캡처)과 운영 경보를 어댑터가 수행한다.
   * RevenueCat 무한 재시도 방지를 위해 호출자는 이후 200으로 응답한다.
   */
  reportWebhookFailure(error: unknown, context: WebhookFailureContext): void;
}
