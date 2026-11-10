import type { SubscriptionEventPayload } from "#api/modules/billing/subscriptions/billing-subscriptions-events.public";

/** 결제 채널 구독 알림 입력. 부가 필드는 없으면 알림에서 "—"로 표시하거나 생략한다. */
export type SubscriptionAlertInput = SubscriptionEventPayload;
