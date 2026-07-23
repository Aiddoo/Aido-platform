import type { RevenueCatWebhookPayload } from "@aido/validators";

import type { SubscriptionEventPayload } from "../../domain/events/subscription-event.payload";

export const SUBSCRIPTION_EVENT_NOTIFIER = Symbol(
	"SUBSCRIPTION_EVENT_NOTIFIER",
);

/**
 * 구독 이벤트 알림 포트.
 *
 * DB 반영 후(커밋 후) 관리자 알림(Discord) 및 결제 이슈 푸시 알림 잡을 fire-and-forget으로
 * 등록한다. 어댑터가 admin-notification·notification 큐 서비스로 위임한다.
 * 웹훅 처리 실패 보고(에러 관측 + 관리자 알림)도 벤더(Sentry·Discord) 추상화로 노출한다.
 */
export interface SubscriptionEventNotifierPort {
	notifySubscriptionEvent(payload: SubscriptionEventPayload): void;
	notifyBillingIssue(userId: string): void;

	/**
	 * 웹훅 처리 실패를 보고한다 (fire-and-forget).
	 * 에러 관측(Sentry 태깅 캡처)과 관리자 알림(Discord)을 어댑터가 수행한다.
	 * RevenueCat 무한 재시도 방지를 위해 호출자는 이후 200으로 응답한다.
	 */
	reportWebhookFailure(error: unknown, payload: RevenueCatWebhookPayload): void;
}
