import type { SubscriptionEventPayload } from "../../domain/events/subscription-event.payload";

export const SUBSCRIPTION_EVENT_NOTIFIER = Symbol(
	"SUBSCRIPTION_EVENT_NOTIFIER",
);

/**
 * 구독 이벤트 알림 포트.
 *
 * DB 반영 후(커밋 후) 관리자 알림(Discord) 및 결제 이슈 푸시 알림 잡을 fire-and-forget으로
 * 등록한다. 어댑터가 admin-notification·notification 큐 서비스로 위임한다.
 */
export interface SubscriptionEventNotifierPort {
	notifySubscriptionEvent(payload: SubscriptionEventPayload): void;
	notifyBillingIssue(userId: string): void;
}
